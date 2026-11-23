"""Explicit, read-only queries against the Prisma SQLite catalog only."""
from pathlib import Path
from contextlib import contextmanager
import sqlite3
from decimal import Decimal, ROUND_CEILING, ROUND_FLOOR

from app.integrations.prisma_sqlite import readonly_connection
from app.integrations.legacy_catalog.mapper import map_category, map_product
from app.schemas.catalog import CatalogCategory, CatalogPage, CatalogProduct, CatalogSort
from app.schemas.catalog_money import minor_units


PRODUCT_COLUMNS = '''
    id, name, slug, sku, description, short_description, brand, status,
    CAST(base_price AS TEXT) AS base_price,
    CAST(promotional_price AS TEXT) AS promotional_price
'''
CATEGORY_COLUMNS = '''
    id, name, slug, description, image_url, parent_id, position
'''


class LegacyCatalogRepository:
    def __init__(self, path: Path) -> None:
        self.path = path

    @contextmanager
    def connection(self):
        with readonly_connection(self.path) as connection:
            connection.create_function('catalog_cents', 1, minor_units, deterministic=True)
            yield connection

    def _products(self, connection: sqlite3.Connection, rows: list[sqlite3.Row]) -> list[CatalogProduct]:
        if not rows:
            return []
        identifiers = [row['id'] for row in rows]
        # Only placeholder count is interpolated; every value stays bound.
        placeholders = ','.join('?' for _ in identifiers)
        images = connection.execute(f'''
            SELECT product_id, id, url, alt_text, position, is_primary FROM product_images
            WHERE product_id IN ({placeholders}) ORDER BY position, id
        ''', identifiers).fetchall()
        categories = connection.execute(f'''
            SELECT pc.product_id, c.id, c.name, c.slug, c.description, c.image_url, c.parent_id, c.position
            FROM categories c JOIN product_categories pc ON pc.category_id = c.id
            WHERE pc.product_id IN ({placeholders}) AND c.is_active = 1 ORDER BY c.position, c.id
        ''', identifiers).fetchall()
        variants = connection.execute(f'''
            SELECT v.product_id, v.id, v.sku, v.name, v.color, v.color_hex, v.size, v.model,
                   CAST(v.price AS TEXT) AS price,
                   CAST(v.promotional_price AS TEXT) AS promotional_price,
                   v.image_url, v.position, i.quantity_available, i.quantity_reserved
            FROM product_variants v LEFT JOIN inventory i ON i.variant_id = v.id
            WHERE v.product_id IN ({placeholders}) AND v.is_active = 1 ORDER BY v.position, v.id
        ''', identifiers).fetchall()
        grouped = []
        for relation in (images, categories, variants):
            buckets: dict[str, list[sqlite3.Row]] = {}
            for item in relation:
                buckets.setdefault(item['product_id'], []).append(item)
            grouped.append(buckets)
        return [map_product(row, *(buckets.get(row['id'], []) for buckets in grouped)) for row in rows]

    def _product(self, connection: sqlite3.Connection, row: sqlite3.Row) -> CatalogProduct:
        return self._products(connection, [row])[0]

    @staticmethod
    def _like_value(value: str) -> str:
        return value.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')

    @staticmethod
    def _has_created_at(connection: sqlite3.Connection) -> bool:
        return any(row['name'] == 'created_at' for row in connection.execute('PRAGMA table_info(products)'))

    def _product_filter(
        self,
        *,
        search: str | None,
        category_slug: str | None,
        min_price: Decimal | None,
        max_price: Decimal | None,
    ) -> tuple[str, list[str]]:
        clauses = ["p.status = 'ACTIVE'"]
        parameters: list[str] = []
        if search:
            pattern = f"%{self._like_value(search)}%"
            clauses.append("(LOWER(p.name) LIKE LOWER(?) ESCAPE '\\' OR LOWER(p.description) LIKE LOWER(?) ESCAPE '\\' OR LOWER(p.brand) LIKE LOWER(?) ESCAPE '\\')")
            parameters.extend([pattern, pattern, pattern])
        if category_slug and category_slug != 'todos':
            clauses.append("EXISTS (SELECT 1 FROM product_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.product_id = p.id AND c.slug = ? AND c.is_active = 1)")
            parameters.append(category_slug)
        if min_price is not None:
            clauses.append('catalog_cents(CAST(p.base_price AS TEXT)) >= CAST(? AS INTEGER)')
            parameters.append(str((min_price * 100).to_integral_value(rounding=ROUND_CEILING)))
        if max_price is not None:
            clauses.append('catalog_cents(CAST(p.base_price AS TEXT)) <= CAST(? AS INTEGER)')
            parameters.append(str((max_price * 100).to_integral_value(rounding=ROUND_FLOOR)))
        return ' AND '.join(clauses), parameters

    def products(
        self,
        offset: int,
        limit: int,
        *,
        search: str | None = None,
        category_slug: str | None = None,
        sort: CatalogSort = 'relevance',
        min_price: Decimal | None = None,
        max_price: Decimal | None = None,
    ) -> CatalogPage[CatalogProduct]:
        with self.connection() as connection:
            where, parameters = self._product_filter(
                search=search,
                category_slug=category_slug,
                min_price=min_price,
                max_price=max_price,
            )
            total = connection.execute(
                f'SELECT count(*) FROM products p WHERE {where}', parameters
            ).fetchone()[0]
            if sort == 'price_asc':
                ordering = 'catalog_cents(CAST(p.base_price AS TEXT)) ASC, p.slug ASC, p.id ASC'
            elif sort == 'price_desc':
                ordering = 'catalog_cents(CAST(p.base_price AS TEXT)) DESC, p.slug ASC, p.id ASC'
            elif sort == 'newest':
                # Synthetic/older Prisma fixtures may not have created_at.
                ordering = 'p.created_at DESC, p.id DESC' if self._has_created_at(connection) else 'p.id DESC'
            else:
                ordering = 'p.slug ASC, p.id ASC'
            rows = connection.execute(f'''
                SELECT {PRODUCT_COLUMNS} FROM products p WHERE {where}
                ORDER BY {ordering} LIMIT ? OFFSET ?
            ''', [*parameters, limit, offset]).fetchall()
            return CatalogPage(items=self._products(connection, rows),
                               total=total, offset=offset, limit=limit)

    def product(self, slug: str) -> CatalogProduct | None:
        with self.connection() as connection:
            row = connection.execute(f'''
                SELECT {PRODUCT_COLUMNS} FROM products
                WHERE slug = ? AND status = 'ACTIVE'
            ''', (slug,)).fetchone()
            return self._product(connection, row) if row else None

    def categories(self, offset: int, limit: int) -> CatalogPage[CatalogCategory]:
        with self.connection() as connection:
            total = connection.execute(
                'SELECT count(*) FROM categories WHERE is_active = 1'
            ).fetchone()[0]
            rows = connection.execute(f'''
                SELECT {CATEGORY_COLUMNS} FROM categories WHERE is_active = 1
                ORDER BY position, id LIMIT ? OFFSET ?
            ''', (limit, offset)).fetchall()
            return CatalogPage(items=[map_category(row) for row in rows],
                               total=total, offset=offset, limit=limit)

    def category(self, slug: str) -> CatalogCategory | None:
        with self.connection() as connection:
            row = connection.execute(
                f'SELECT {CATEGORY_COLUMNS} FROM categories WHERE slug = ? AND is_active = 1', (slug,)
            ).fetchone()
            return map_category(row) if row else None
