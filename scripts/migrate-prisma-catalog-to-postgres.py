"""Import the legacy Prisma catalog into the local PostgreSQL catalog.

The source SQLite database is opened read-only. The destination is fixed to
the explicitly authorized local database and is validated before any write.
The import is additive and idempotent by product slug/SKU and variant SKU.
"""

from __future__ import annotations

import argparse
import getpass
import sqlite3
import sys
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from urllib.parse import quote_plus

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Connection


TARGET_HOST = "127.0.0.1"
TARGET_PORT = 5432
TARGET_DATABASE = "focusstore_test"
TARGET_USER = "postgres"
TARGET_SCHEMA = "public"


class MigrationConflict(RuntimeError):
    pass


def source_connection(path: Path) -> sqlite3.Connection:
    if not path.is_file():
        raise FileNotFoundError(f"Fonte SQLite não encontrada: {path}")
    connection = sqlite3.connect(f"file:{path.resolve()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA query_only = ON")
    return connection


def source_rows(connection: sqlite3.Connection, table: str) -> list[sqlite3.Row]:
    return connection.execute(f"SELECT * FROM {table}").fetchall()


def source_datetime(value: int | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromtimestamp(value / 1000, tz=timezone.utc).replace(tzinfo=None)


def validate_destination(password: str):
    url = (
        f"postgresql+psycopg://{TARGET_USER}:{quote_plus(password)}"
        f"@{TARGET_HOST}:{TARGET_PORT}/{TARGET_DATABASE}"
    )
    engine = create_engine(url, hide_parameters=True, pool_pre_ping=True)
    with engine.connect() as connection:
        identity = connection.execute(text(
            "SELECT current_user, current_database(), current_schema()"
        )).one()
        if identity[0] != TARGET_USER or identity[1] != TARGET_DATABASE:
            raise RuntimeError(
                "Destino recusado: a identidade efetiva não é postgres/focusstore_test."
            )
        connection.execute(text("SET search_path TO public"))
        if connection.execute(text("SELECT current_schema()")).scalar_one() != TARGET_SCHEMA:
            raise RuntimeError("Destino recusado: o schema efetivo não é public.")
        required = {
            "categories", "products", "product_categories", "product_images",
            "product_variants", "inventory",
        }
        missing = required.difference(inspect(connection).get_table_names(schema=TARGET_SCHEMA))
        if missing:
            raise RuntimeError(f"Destino recusado: tabelas ausentes: {', '.join(sorted(missing))}")
    return engine


def ensure_category(connection: Connection, row: sqlite3.Row, stats: Counter) -> int:
    existing = connection.execute(
        text("SELECT id, name FROM categories WHERE slug = :slug"), {"slug": row["slug"]}
    ).one_or_none()
    if existing:
        if existing.name != row["name"]:
            raise MigrationConflict(
                f"Categoria slug={row['slug']} já existe com nome incompatível."
            )
        stats["categories_skipped"] += 1
        return existing.id

    result = connection.execute(text("""
        INSERT INTO categories (name, slug, description, image_url, parent_id, position, is_active, created_at, updated_at)
        VALUES (:name, :slug, :description, :image_url, NULL, :position, :is_active, :created_at, :updated_at)
        RETURNING id
    """), {
        "name": row["name"], "slug": row["slug"], "description": row["description"],
        "image_url": row["image_url"], "position": row["position"],
        "is_active": bool(row["is_active"]),
        "created_at": source_datetime(row["created_at"]),
        "updated_at": source_datetime(row["updated_at"]),
    })
    stats["categories_imported"] += 1
    return result.scalar_one()


def find_product(connection: Connection, row: sqlite3.Row):
    by_slug = connection.execute(
        text("SELECT id, slug, sku, name FROM products WHERE slug = :slug"), {"slug": row["slug"]}
    ).one_or_none()
    by_sku = connection.execute(
        text("SELECT id, slug, sku, name FROM products WHERE sku = :sku"), {"sku": row["sku"]}
    ).one_or_none()
    if by_slug and by_sku and by_slug.id != by_sku.id:
        raise MigrationConflict(
            f"Produto slug={row['slug']} e SKU={row['sku']} apontam para registros diferentes."
        )
    return by_slug or by_sku


def import_catalog(source: Path, engine) -> Counter:
    stats = Counter()
    with source_connection(source) as sqlite:
        categories = source_rows(sqlite, "categories")
        products = source_rows(sqlite, "products")
        images = source_rows(sqlite, "product_images")
        variants = source_rows(sqlite, "product_variants")
        inventories = {row["variant_id"]: row for row in source_rows(sqlite, "inventory")}
        product_categories = source_rows(sqlite, "product_categories")
        category_by_source_id = {row["id"]: row for row in categories}
        categories_by_product: dict[str, list[str]] = {}
        for relation in product_categories:
            categories_by_product.setdefault(relation["product_id"], []).append(relation["category_id"])
        images_by_product: dict[str, list[sqlite3.Row]] = {}
        for row in images:
            images_by_product.setdefault(row["product_id"], []).append(row)
        variants_by_product: dict[str, list[sqlite3.Row]] = {}
        for row in variants:
            variants_by_product.setdefault(row["product_id"], []).append(row)

        with engine.begin() as connection:
            category_ids = {
                row["id"]: ensure_category(connection, row, stats) for row in categories
            }
            for row in products:
                source_category_ids = categories_by_product.get(row["id"], [])
                if not source_category_ids:
                    raise MigrationConflict(
                        f"Produto slug={row['slug']} não possui categoria primária compatível."
                    )
                primary_category_id = category_ids[source_category_ids[0]]
                source_variants = variants_by_product.get(row["id"], [])
                source_stock = sum(
                    int(inventories[variant["id"]]["quantity_available"])
                    for variant in source_variants
                    if variant["id"] in inventories
                )
                existing = find_product(connection, row)
                if existing:
                    product_id = existing.id
                    stats["products_skipped"] += 1
                else:
                    product_id = connection.execute(text("""
                        INSERT INTO products
                          (name, description, price, stock, category_id, slug, sku,
                           short_description, brand, base_price, promotional_price,
                           status, is_featured, created_at, updated_at)
                        VALUES
                          (:name, :description, :price, :stock, :category_id, :slug, :sku,
                           :short_description, :brand, :base_price, :promotional_price,
                           :status, :is_featured, :created_at, :updated_at)
                        RETURNING id
                    """), {
                        "name": row["name"], "description": row["description"],
                        "price": Decimal(str(row["base_price"])), "stock": source_stock,
                        "category_id": primary_category_id, "slug": row["slug"], "sku": row["sku"],
                        "short_description": row["short_description"], "brand": row["brand"],
                        "base_price": Decimal(str(row["base_price"])),
                        "promotional_price": Decimal(str(row["promotional_price"])) if row["promotional_price"] is not None else None,
                        "status": row["status"], "is_featured": bool(row["is_featured"]),
                        "created_at": source_datetime(row["created_at"]),
                        "updated_at": source_datetime(row["updated_at"]),
                    }).scalar_one()
                    stats["products_imported"] += 1

                for source_category_id in source_category_ids:
                    connection.execute(text("""
                        INSERT INTO product_categories (product_id, category_id)
                        VALUES (:product_id, :category_id)
                        ON CONFLICT DO NOTHING
                    """), {"product_id": product_id, "category_id": category_ids[source_category_id]})

                for image in images_by_product.get(row["id"], []):
                    exists = connection.execute(text("""
                        SELECT 1 FROM product_images
                        WHERE product_id = :product_id AND url = :url AND position = :position
                    """), {"product_id": product_id, "url": image["url"], "position": image["position"]}).first()
                    if exists:
                        stats["images_skipped"] += 1
                    else:
                        connection.execute(text("""
                            INSERT INTO product_images (product_id, url, alt_text, position, is_primary)
                            VALUES (:product_id, :url, :alt_text, :position, :is_primary)
                        """), {
                            "product_id": product_id, "url": image["url"],
                            "alt_text": image["alt_text"], "position": image["position"],
                            "is_primary": bool(image["is_primary"]),
                        })
                        stats["images_imported"] += 1

                for variant in source_variants:
                    existing_variant = connection.execute(text(
                        "SELECT id, product_id FROM product_variants WHERE sku = :sku"
                    ), {"sku": variant["sku"]}).one_or_none()
                    if existing_variant and existing_variant.product_id != product_id:
                        raise MigrationConflict(
                            f"Variante SKU={variant['sku']} pertence a outro produto."
                        )
                    if existing_variant:
                        variant_id = existing_variant.id
                        stats["variants_skipped"] += 1
                    else:
                        variant_id = connection.execute(text("""
                            INSERT INTO product_variants
                              (product_id, sku, name, color, color_hex, size, model, price,
                               promotional_price, image_url, position, is_active, created_at, updated_at)
                            VALUES
                              (:product_id, :sku, :name, :color, :color_hex, :size, :model, :price,
                               :promotional_price, :image_url, :position, :is_active, :created_at, :updated_at)
                            RETURNING id
                        """), {
                            "product_id": product_id, "sku": variant["sku"], "name": variant["name"],
                            "color": variant["color"], "color_hex": variant["color_hex"],
                            "size": variant["size"], "model": variant["model"],
                            "price": Decimal(str(variant["price"])),
                            "promotional_price": Decimal(str(variant["promotional_price"])) if variant["promotional_price"] is not None else None,
                            "image_url": variant["image_url"], "position": variant["position"],
                            "is_active": bool(variant["is_active"]),
                            "created_at": source_datetime(variant["created_at"]),
                            "updated_at": source_datetime(variant["updated_at"]),
                        }).scalar_one()
                        stats["variants_imported"] += 1

                    inventory = inventories.get(variant["id"])
                    if inventory is None:
                        continue
                    inventory_exists = connection.execute(text(
                        "SELECT 1 FROM inventory WHERE variant_id = :variant_id"
                    ), {"variant_id": variant_id}).first()
                    if inventory_exists:
                        stats["inventory_skipped"] += 1
                    else:
                        connection.execute(text("""
                            INSERT INTO inventory (variant_id, quantity_available, quantity_reserved, updated_at)
                            VALUES (:variant_id, :quantity_available, :quantity_reserved, :updated_at)
                        """), {
                            "variant_id": variant_id,
                            "quantity_available": inventory["quantity_available"],
                            "quantity_reserved": inventory["quantity_reserved"],
                            "updated_at": source_datetime(inventory["updated_at"]),
                        })
                        stats["inventory_imported"] += 1

            stats["collection_links_not_migrated"] = sqlite.execute(
                "SELECT count(*) FROM collection_products"
            ).fetchone()[0]
    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source", type=Path,
        default=Path("prisma/dev.backup.db"),
        help="SQLite Prisma source opened read-only (default: prisma/dev.backup.db)",
    )
    args = parser.parse_args()
    print(f"Fonte somente leitura: {args.source.resolve()}")
    print(f"Destino autorizado: {TARGET_USER}@{TARGET_HOST}:{TARGET_PORT}/{TARGET_DATABASE}, schema {TARGET_SCHEMA}")
    password = getpass.getpass("Senha do PostgreSQL local (não será salva): ")
    try:
        engine = validate_destination(password)
        print("Destino validado: PostgreSQL local autorizado.")
        answer = input("Executar importação transacional agora? [s/N] ").strip().lower()
        if answer not in {"s", "sim", "y", "yes"}:
            print("Importação cancelada antes de qualquer escrita.")
            return 0
        stats = import_catalog(args.source, engine)
        print("Importação concluída com commit:")
        for key in sorted(stats):
            print(f"  {key}={stats[key]}")
        return 0
    except (OSError, sqlite3.Error, MigrationConflict, RuntimeError) as exc:
        print(f"IMPORTAÇÃO ABORTADA (rollback aplicado se necessário): {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
