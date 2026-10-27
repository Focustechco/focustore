"""Explicit, read-only queries against the Prisma SQLite catalog only."""
from collections import defaultdict
from contextlib import contextmanager
from pathlib import Path
import sqlite3
from collections.abc import Iterator, Sequence

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
    def __init__(self, path: Path, excluded_slugs: Sequence[str] = ()) -> None:
        self.path = path
        self.excluded_slugs = tuple(excluded_slugs)

    def _public_filter(self) -> tuple[str, list[str]]:
        if not self.excluded_slugs:
            return "status = 'ACTIVE'", []
        placeholders = ','.join('?' for _ in self.excluded_slugs)
        return f"status = 'ACTIVE' AND slug NOT IN ({placeholders})", list(self.excluded_slugs)

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

    def _products(self, connection: sqlite3.Connection, rows: list[sqlite3.Row]) -> list[CatalogProduct]:
        if not rows:
            return []
        ids = [row['id'] for row in rows]
        placeholders = ','.join('?' for _ in ids)
        images = connection.execute(f'''
            SELECT product_id, id, url, alt_text, position, is_primary FROM product_images
            WHERE product_id IN ({placeholders}) ORDER BY position, id
        ''', ids).fetchall()
        categories = connection.execute(f'''
            SELECT pc.product_id, c.id, c.name, c.slug, c.description, c.image_url, c.parent_id, c.position
            FROM categories c JOIN product_categories pc ON pc.category_id = c.id
            WHERE pc.product_id IN ({placeholders}) AND c.is_active = 1 ORDER BY c.position, c.id
        ''', ids).fetchall()
        variants = connection.execute(f'''
            SELECT v.product_id, v.id, v.sku, v.name, v.color, v.color_hex, v.size, v.model,
                   CAST(v.price AS TEXT) AS price,
                   CAST(v.promotional_price AS TEXT) AS promotional_price,
                   v.image_url, v.position, i.quantity_available, i.quantity_reserved
            FROM product_variants v LEFT JOIN inventory i ON i.variant_id = v.id
            WHERE v.product_id IN ({placeholders}) AND v.is_active = 1 ORDER BY v.position, v.id
        ''', ids).fetchall()
        grouped: list[dict[str, list[sqlite3.Row]]] = []
        for related in (images, categories, variants):
            by_product: dict[str, list[sqlite3.Row]] = defaultdict(list)
            for item in related:
                by_product[item['product_id']].append(item)
            grouped.append(by_product)
        return [map_product(row, grouped[0][row['id']], grouped[1][row['id']], grouped[2][row['id']])
                for row in rows]

    def products(self, offset: int, limit: int) -> CatalogPage[CatalogProduct]:
        public_filter, params = self._public_filter()
        with self.connection() as connection:
            total = connection.execute(
                f'SELECT count(*) FROM products WHERE {public_filter}', params
            ).fetchone()[0]
            rows = connection.execute(f'''
                SELECT {PRODUCT_COLUMNS} FROM products WHERE {public_filter}
                ORDER BY slug, id LIMIT ? OFFSET ?
            ''', [*params, limit, offset]).fetchall()
            return CatalogPage(items=self._products(connection, rows),
                               total=total, offset=offset, limit=limit)

    def product(self, slug: str) -> CatalogProduct | None:
        public_filter, params = self._public_filter()
        with self.connection() as connection:
            row = connection.execute(f'''
                SELECT {PRODUCT_COLUMNS} FROM products
                WHERE slug = ? AND {public_filter}
            ''', [slug, *params]).fetchone()
            return self._products(connection, [row])[0] if row else None

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
