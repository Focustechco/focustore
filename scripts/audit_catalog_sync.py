"""Audit and optionally synchronize the legacy Prisma catalog into local PostgreSQL.

The SQLite source is opened read-only. Without --apply this command performs no
PostgreSQL write. With --apply, it refuses ambiguous product identity conflicts
and performs a selective additive transaction for the approved product slugs.
"""

from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from urllib.parse import unquote, urlsplit

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine


EXPECTED = {
    'host': '127.0.0.1',
    'port': 5432,
    'database': 'focusstore_test',
    'user': 'postgres',
    'schema': 'public',
}
SAFE_PRODUCT_SLUGS = {
    'camisa-dev-collection-typescript',
    'camisa-dev-collection-csharp',
    'camisa-focus-academy',
}


def fail(message: str) -> None:
    print(f'FAIL: {message}', file=sys.stderr)
    raise SystemExit(1)


def source_connection(path: Path) -> sqlite3.Connection:
    if not path.is_file():
        fail(f'fonte SQLite não encontrada: {path}')
    connection = sqlite3.connect(f'file:{path.resolve()}?mode=ro', uri=True)
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA query_only = ON')
    integrity = connection.execute('PRAGMA integrity_check').fetchone()[0]
    if integrity != 'ok':
        connection.close()
        fail(f'integrity_check falhou em {path}: {integrity}')
    if connection.execute('PRAGMA foreign_key_check').fetchone() is not None:
        connection.close()
        fail(f'foreign_key_check encontrou inconsistências em {path}')
    return connection


def rows(connection: sqlite3.Connection, table: str) -> list[sqlite3.Row]:
    return connection.execute(f'SELECT * FROM "{table}"').fetchall()


def validate_destination(engine: Engine) -> None:
    with engine.connect() as connection:
        identity = connection.execute(text(
            'SELECT inet_server_addr(), inet_server_port(), current_database(), '
            'current_user, current_schema()'
        )).one()
        if str(identity[0]) != EXPECTED['host'] or identity[1] != EXPECTED['port']:
            fail('destino recusado: servidor efetivo diferente de 127.0.0.1:5432.')
        if identity[2] != EXPECTED['database'] or identity[3] != EXPECTED['user']:
            fail('destino recusado: banco ou usuário efetivo diferente do autorizado.')
        if identity[4] != EXPECTED['schema']:
            fail('destino recusado: schema efetivo diferente de public.')
        tables = {
            row[0] for row in connection.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name IN "
                "('categories','products','product_categories','product_images',"
                "'product_variants','inventory')"
            ))
        }
        if len(tables) != 6:
            fail(f'tabelas de catálogo ausentes no destino: {sorted(set(('categories','products','product_categories','product_images','product_variants','inventory')) - tables)}')


def decimal(value: object) -> Decimal | None:
    return None if value is None else Decimal(str(value)).quantize(Decimal('0.01'))


def audit_source(source: Path, engine: Engine) -> dict[str, object]:
    with source_connection(source) as sqlite:
        products = rows(sqlite, 'products')
        variants = rows(sqlite, 'product_variants')
        images = rows(sqlite, 'product_images')
        categories = rows(sqlite, 'categories')
        product_categories = rows(sqlite, 'product_categories')
        inventory = rows(sqlite, 'inventory')
        source_categories = {row['id']: row['slug'] for row in categories}
        source_product_categories: dict[str, set[str]] = defaultdict(set)
        for relation in product_categories:
            source_product_categories[relation['product_id']].add(source_categories[relation['category_id']])
        source_variants: dict[str, list[sqlite3.Row]] = defaultdict(list)
        for variant in variants:
            source_variants[variant['product_id']].append(variant)
        source_images: dict[str, list[sqlite3.Row]] = defaultdict(list)
        for image in images:
            source_images[image['product_id']].append(image)

        with engine.connect() as connection:
            destination_products = connection.execute(text(
                'SELECT id, slug, sku, name, price, promotional_price, status FROM public.products'
            )).mappings().all()
            destination_categories = {
                row['slug']: row for row in connection.execute(text(
                    'SELECT id, slug, name FROM public.categories'
                )).mappings()
            }
            destination_variants = connection.execute(text(
                'SELECT id, product_id, sku FROM public.product_variants'
            )).mappings().all()
            destination_images = connection.execute(text(
                'SELECT product_id, url, position FROM public.product_images'
            )).mappings().all()
            destination_relations = connection.execute(text(
                'SELECT pc.product_id, c.slug FROM public.product_categories pc '
                'JOIN public.categories c ON c.id = pc.category_id'
            )).mappings().all()

        by_slug = {row['slug']: row for row in destination_products}
        by_sku = {row['sku']: row for row in destination_products}
        variants_by_sku = {row['sku']: row for row in destination_variants}
        images_by_product: dict[int, set[tuple[str, int]]] = defaultdict(set)
        for row in destination_images:
            images_by_product[row['product_id']].add((row['url'], row['position']))
        relations_by_product: dict[int, set[str]] = defaultdict(set)
        for row in destination_relations:
            relations_by_product[row['product_id']].add(row['slug'])

        report: dict[str, object] = {
            'source_products': len(products),
            'source_variants': len(variants),
            'source_images': len(images),
            'source_categories': len(categories),
            'destination_products': len(destination_products),
            'products_existing': [], 'products_missing': [], 'product_conflicts': [],
            'categories_missing': [],
            'variants_missing': [], 'images_missing': [], 'relations_missing': [],
            'inventory_source_rows': len(inventory),
        }
        seen_source_skus: set[str] = set()
        for product in products:
            seen_source_skus.update(variant['sku'] for variant in source_variants[product['id']])
            slug_match = by_slug.get(product['slug'])
            sku_match = by_sku.get(product['sku'])
            if slug_match and sku_match and slug_match['id'] != sku_match['id']:
                report['product_conflicts'].append({
                    'slug': product['slug'], 'sku': product['sku'], 'reason': 'slug e SKU apontam para produtos distintos',
                })
                continue
            destination = slug_match or sku_match
            if destination is None:
                report['products_missing'].append(product['slug'])
                report['variants_missing'].extend(variant['sku'] for variant in source_variants[product['id']])
                report['images_missing'].extend(
                    f"{product['slug']}:{image['url']}@{image['position']}"
                    for image in source_images[product['id']]
                )
                continue
            report['products_existing'].append(product['slug'])
            divergences = []
            if destination['name'] != product['name']:
                divergences.append('name')
            if decimal(destination['price']) != decimal(product['base_price']):
                divergences.append('price')
            if decimal(destination['promotional_price']) != decimal(product['promotional_price']):
                divergences.append('promotional_price')
            if destination['status'] != product['status']:
                divergences.append('status')
            if divergences:
                report['product_conflicts'].append({
                    'slug': product['slug'], 'sku': product['sku'], 'reason': 'dados divergentes', 'fields': divergences,
                })
            destination_id = destination['id']
            for variant in source_variants[product['id']]:
                existing_variant = variants_by_sku.get(variant['sku'])
                if existing_variant is None:
                    report['variants_missing'].append(variant['sku'])
                elif existing_variant['product_id'] != destination_id:
                    report['product_conflicts'].append({
                        'slug': product['slug'], 'sku': variant['sku'], 'reason': 'SKU de variante pertence a outro produto',
                    })
            for image in source_images[product['id']]:
                if (image['url'], image['position']) not in images_by_product[destination_id]:
                    report['images_missing'].append(f"{product['slug']}:{image['url']}@{image['position']}")
            existing_relations = relations_by_product[destination_id]
            for category_slug in source_product_categories[product['id']]:
                if category_slug not in destination_categories:
                    if category_slug not in report['categories_missing']:
                        report['categories_missing'].append(category_slug)
                elif next((row['name'] for row in categories if row['slug'] == category_slug), None) != destination_categories[category_slug]['name']:
                    report['product_conflicts'].append({
                        'category': category_slug, 'reason': 'categoria possui nome divergente',
                    })
                elif category_slug not in existing_relations:
                    report['relations_missing'].append(f'{product["slug"]}:{category_slug}')

        duplicates = len(products) - len({row['slug'] for row in products})
        duplicate_skus = len(variants) - len(seen_source_skus)
        report['source_duplicate_slugs'] = duplicates
        report['source_duplicate_variant_skus'] = duplicate_skus
        return report


def print_report(report: dict[str, object], source: Path) -> None:
    print(f'Fonte somente leitura: {source.resolve()}')
    for key in ('source_products', 'source_variants', 'source_images', 'source_categories', 'inventory_source_rows', 'destination_products'):
        print(f'{key}={report[key]}')
    for key in ('products_existing', 'products_missing', 'product_conflicts', 'categories_missing', 'variants_missing', 'images_missing', 'relations_missing'):
        values = report[key]
        print(f'{key}_count={len(values)}')
        if values:
            print(f'{key}={values}')
    print(f"source_duplicate_slugs={report['source_duplicate_slugs']}")
    print(f"source_duplicate_variant_skus={report['source_duplicate_variant_skus']}")


def source_datetime(value: object) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value / 1000, tz=timezone.utc).replace(tzinfo=None)
    return datetime.fromisoformat(str(value).replace('Z', '+00:00')).replace(tzinfo=None)


def image_exists(root: Path, url: str) -> bool:
    parsed = urlsplit(url)
    if parsed.scheme or parsed.netloc:
        return True
    relative = unquote(parsed.path.lstrip('/'))
    return (root / relative).is_file()


def import_selected(source: Path, engine, slugs: set[str]) -> None:
    public_root = Path(__file__).parents[1] / 'public'
    with source_connection(source) as sqlite, engine.begin() as connection:
        products = {row['slug']: row for row in rows(sqlite, 'products')}
        categories = {row['id']: row for row in rows(sqlite, 'categories')}
        variants = rows(sqlite, 'product_variants')
        images = rows(sqlite, 'product_images')
        relations = rows(sqlite, 'product_categories')
        inventories = {row['variant_id']: row for row in rows(sqlite, 'inventory')}
        variants_by_product: dict[str, list[sqlite3.Row]] = defaultdict(list)
        images_by_product: dict[str, list[sqlite3.Row]] = defaultdict(list)
        category_ids_by_product: dict[str, list[str]] = defaultdict(list)
        for row in variants:
            variants_by_product[row['product_id']].append(row)
        for row in images:
            images_by_product[row['product_id']].append(row)
        for row in relations:
            category_ids_by_product[row['product_id']].append(row['category_id'])

        stats = defaultdict(int)
        for slug in sorted(slugs):
            product = products.get(slug)
            if product is None:
                fail(f'produto selecionado ausente na fonte SQLite: {slug}')
            existing_by_slug = connection.execute(text(
                'SELECT id, sku FROM public.products WHERE slug = :slug'
            ), {'slug': slug}).mappings().one_or_none()
            existing_by_sku = connection.execute(text(
                'SELECT id, slug FROM public.products WHERE sku = :sku'
            ), {'sku': product['sku']}).mappings().one_or_none()
            if existing_by_slug and existing_by_sku and existing_by_slug['id'] != existing_by_sku['id']:
                raise RuntimeError(f'conflito de identidade para {slug}: slug e SKU divergem')
            if existing_by_slug or existing_by_sku:
                stats['products_skipped'] += 1
                continue

            category_dest_ids = []
            for category_source_id in category_ids_by_product[product['id']]:
                category = categories[category_source_id]
                existing_category = connection.execute(text(
                    'SELECT id, name FROM public.categories WHERE slug = :slug'
                ), {'slug': category['slug']}).mappings().one_or_none()
                if existing_category:
                    if existing_category['name'] != category['name']:
                        raise RuntimeError(f'conflito de categoria: {category["slug"]}')
                    category_dest_ids.append(existing_category['id'])
                    stats['categories_skipped'] += 1
                else:
                    category_dest_ids.append(connection.execute(text(
                        'INSERT INTO public.categories '
                        '(name, slug, description, image_url, parent_id, position, is_active, created_at, updated_at) '
                        'VALUES (:name, :slug, :description, :image_url, NULL, :position, :is_active, :created_at, :updated_at) '
                        'RETURNING id'
                    ), {
                        'name': category['name'], 'slug': category['slug'],
                        'description': category['description'], 'image_url': category['image_url'],
                        'position': category['position'], 'is_active': bool(category['is_active']),
                        'created_at': source_datetime(category['created_at']),
                        'updated_at': source_datetime(category['updated_at']),
                    }).scalar_one())
                    stats['categories_imported'] += 1

            if not category_dest_ids:
                raise RuntimeError(f'produto sem categoria válida na fonte: {slug}')

            source_variants = variants_by_product[product['id']]
            stock = sum(int(inventories[v['id']]['quantity_available']) for v in source_variants if v['id'] in inventories)
            product_id = connection.execute(text(
                'INSERT INTO public.products '
                '(name, description, price, stock, category_id, slug, sku, short_description, brand, '
                'base_price, promotional_price, status, is_featured, created_at, updated_at) '
                'VALUES (:name, :description, :price, :stock, :category_id, :slug, :sku, :short_description, '
                ':brand, :base_price, :promotional_price, :status, :is_featured, :created_at, :updated_at) '
                'RETURNING id'
            ), {
                'name': product['name'], 'description': product['description'],
                'price': Decimal(str(product['base_price'])), 'stock': stock,
                'category_id': category_dest_ids[0], 'slug': product['slug'], 'sku': product['sku'],
                'short_description': product['short_description'], 'brand': product['brand'],
                'base_price': Decimal(str(product['base_price'])),
                'promotional_price': Decimal(str(product['promotional_price'])) if product['promotional_price'] is not None else None,
                'status': product['status'], 'is_featured': bool(product['is_featured']),
                'created_at': source_datetime(product['created_at']), 'updated_at': source_datetime(product['updated_at']),
            }).scalar_one()
            stats['products_imported'] += 1

            for category_id in category_dest_ids:
                connection.execute(text(
                    'INSERT INTO public.product_categories (product_id, category_id) '
                    'VALUES (:product_id, :category_id) ON CONFLICT DO NOTHING'
                ), {'product_id': product_id, 'category_id': category_id})
                stats['relations_imported'] += 1

            for image in images_by_product[product['id']]:
                if not image_exists(public_root, image['url']):
                    stats['images_missing_source_file'] += 1
                    print(f"WARN: imagem não copiada; arquivo ausente: {image['url']} ({slug})")
                    continue
                connection.execute(text(
                    'INSERT INTO public.product_images (product_id, url, alt_text, position, is_primary) '
                    'VALUES (:product_id, :url, :alt_text, :position, :is_primary)'
                ), {'product_id': product_id, 'url': image['url'], 'alt_text': image['alt_text'],
                    'position': image['position'], 'is_primary': bool(image['is_primary'])})
                stats['images_imported'] += 1

            for variant in source_variants:
                existing_variant = connection.execute(text(
                    'SELECT id, product_id FROM public.product_variants WHERE sku = :sku'
                ), {'sku': variant['sku']}).mappings().one_or_none()
                if existing_variant:
                    raise RuntimeError(f'SKU de variante já existe e não será reutilizado: {variant["sku"]}')
                variant_id = connection.execute(text(
                    'INSERT INTO public.product_variants '
                    '(product_id, sku, name, color, color_hex, size, model, price, promotional_price, image_url, position, is_active, created_at, updated_at) '
                    'VALUES (:product_id, :sku, :name, :color, :color_hex, :size, :model, :price, :promotional_price, :image_url, :position, :is_active, :created_at, :updated_at) '
                    'RETURNING id'
                ), {'product_id': product_id, 'sku': variant['sku'], 'name': variant['name'],
                    'color': variant['color'], 'color_hex': variant['color_hex'], 'size': variant['size'],
                    'model': variant['model'], 'price': Decimal(str(variant['price'])),
                    'promotional_price': Decimal(str(variant['promotional_price'])) if variant['promotional_price'] is not None else None,
                    'image_url': variant['image_url'], 'position': variant['position'],
                    'is_active': bool(variant['is_active']), 'created_at': source_datetime(variant['created_at']),
                    'updated_at': source_datetime(variant['updated_at'])}).scalar_one()
                stats['variants_imported'] += 1
                inventory = inventories.get(variant['id'])
                if inventory:
                    connection.execute(text(
                        'INSERT INTO public.inventory (variant_id, quantity_available, quantity_reserved, updated_at) '
                        'VALUES (:variant_id, :quantity_available, :quantity_reserved, :updated_at)'
                    ), {'variant_id': variant_id, 'quantity_available': inventory['quantity_available'],
                        'quantity_reserved': inventory['quantity_reserved'], 'updated_at': source_datetime(inventory['updated_at'])})
                    stats['inventory_imported'] += 1
    print('Importação transacional concluída:')
    for key in sorted(stats):
        print(f'  {key}={stats[key]}')


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path('prisma/dev.backup.db'))
    parser.add_argument('--database-url-env', default='FOCUS_CATALOG_DATABASE_URL')
    parser.add_argument('--apply', action='store_true', help='importa somente os slugs selecionados')
    parser.add_argument('--product-slug', action='append', dest='product_slugs',
                        default=None,
                        help='slug a importar; pode ser repetido')
    args = parser.parse_args()
    raw_url = os.environ.get(args.database_url_env, '')
    if not raw_url:
        fail(f'a variável {args.database_url_env} não foi fornecida; nenhuma escrita foi realizada.')
    engine = create_engine(raw_url, hide_parameters=True, pool_pre_ping=True)
    validate_destination(engine)
    report = audit_source(args.source, engine)
    print_report(report, args.source)
    if not args.apply:
        print('DRY-RUN: nenhuma escrita foi realizada.')
        return 0
    selected = set(args.product_slugs or SAFE_PRODUCT_SLUGS)
    selected_conflicts = [item for item in report['product_conflicts'] if item.get('slug') in selected]
    if selected_conflicts:
        fail('importação bloqueada: há conflitos nos slugs selecionados; nenhum registro foi alterado.')
    import_selected(args.source, engine, selected)
    print('PASS: sincronização aditiva concluída sem apagar ou sobrescrever produtos existentes.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
