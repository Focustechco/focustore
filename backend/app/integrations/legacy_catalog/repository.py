"""Explicit, read-only queries against the Prisma SQLite catalog only."""
from pathlib import Path
import sqlite3
from decimal import Decimal

from app.integrations.prisma_sqlite import readonly_connection
from app.integrations.legacy_catalog.mapper import map_category, map_product
from app.schemas.catalog import CatalogCategory, CatalogPage, CatalogProduct, CatalogSort


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

    def connection(self):
        return readonly_connection(self.path)

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
            clauses.append('p.base_price >= ?')
            parameters.append(str(min_price))
        if max_price is not None:
            clauses.append('p.base_price <= ?')
            parameters.append(str(max_price))
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
                ordering = 'p.base_price ASC, p.slug ASC, p.id ASC'
            elif sort == 'price_desc':
                ordering = 'p.base_price DESC, p.slug ASC, p.id ASC'
            elif sort == 'newest':
                # Synthetic/older Prisma fixtures may not have created_at.
                ordering = 'p.created_at DESC, p.id DESC' if self._has_created_at(connection) else 'p.id DESC'
            else:
                ordering = 'p.slug ASC, p.id ASC'
            rows = connection.execute(f'''
                SELECT {PRODUCT_COLUMNS} FROM products p WHERE {where}
                ORDER BY {ordering} LIMIT ? OFFSET ?
            ''', [*parameters, limit, offset]).fetchall()
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
