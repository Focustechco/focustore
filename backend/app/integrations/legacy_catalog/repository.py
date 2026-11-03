"""Explicit, read-only queries against the Prisma SQLite catalog only."""
from contextlib import contextmanager
from pathlib import Path
import sqlite3
from collections.abc import Iterator

from app.integrations.legacy_catalog.mapper import map_category, map_product
from app.schemas.catalog import CatalogCategory, CatalogPage, CatalogProduct


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
    def connection(self) -> Iterator[sqlite3.Connection]:
        if not self.path.is_absolute():
            raise ValueError('Catalog path must be absolute')
        # mode=ro must fail if missing; never create an empty source database.
        connection = sqlite3.connect(self.path.as_uri() + '?mode=ro', uri=True, timeout=2)
        connection.row_factory = sqlite3.Row
        try:
            connection.execute('PRAGMA query_only = ON')
            connection.execute('BEGIN')
            yield connection
        finally:
            connection.close()

    def _product(self, connection: sqlite3.Connection, row: sqlite3.Row) -> CatalogProduct:
        images = connection.execute('''
            SELECT id, url, alt_text, position, is_primary FROM product_images
            WHERE product_id = ? ORDER BY position, id
        ''', (row['id'],)).fetchall()
        categories = connection.execute('''
            SELECT c.id, c.name, c.slug, c.description, c.image_url, c.parent_id, c.position
            FROM categories c JOIN product_categories pc ON pc.category_id = c.id
            WHERE pc.product_id = ? AND c.is_active = 1 ORDER BY c.position, c.id
        ''', (row['id'],)).fetchall()
        variants = connection.execute('''
            SELECT v.id, v.sku, v.name, v.color, v.color_hex, v.size, v.model,
                   CAST(v.price AS TEXT) AS price,
                   CAST(v.promotional_price AS TEXT) AS promotional_price,
                   v.image_url, v.position, i.quantity_available, i.quantity_reserved
            FROM product_variants v LEFT JOIN inventory i ON i.variant_id = v.id
            WHERE v.product_id = ? AND v.is_active = 1 ORDER BY v.position, v.id
        ''', (row['id'],)).fetchall()
        return map_product(row, images, categories, variants)

    def products(self, offset: int, limit: int) -> CatalogPage[CatalogProduct]:
        with self.connection() as connection:
            total = connection.execute(
                "SELECT count(*) FROM products WHERE status = 'ACTIVE'"
            ).fetchone()[0]
            rows = connection.execute(f'''
                SELECT {PRODUCT_COLUMNS} FROM products WHERE status = 'ACTIVE'
                ORDER BY slug, id LIMIT ? OFFSET ?
            ''', (limit, offset)).fetchall()
            return CatalogPage(items=[self._product(connection, row) for row in rows],
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
