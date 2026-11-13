"""Explicit read-only source; errors propagate so callers can fail closed."""
from pathlib import Path
from uuid import UUID

from app.integrations.prisma_sqlite import readonly_connection
from app.services.catalog_mapping_policy import VariantSnapshot, catalog_diagnostics, money, normalize


class PrismaMappingSource:
    def __init__(self, path: Path, namespace: str):
        if not namespace.strip() or len(namespace) > 80:
            raise ValueError('A stable Prisma source namespace is required')
        self.path = path
        self.namespace = namespace

    def snapshot(self, identifier: UUID) -> VariantSnapshot | None:
        with readonly_connection(self.path) as connection:
            row = connection.execute('''
                SELECT v.*, p.sku AS parent_sku, p.status AS parent_status,
                       i.quantity_available, i.quantity_reserved
                FROM product_variants v JOIN products p ON p.id = v.product_id
                LEFT JOIN inventory i ON i.variant_id = v.id WHERE v.id = ?
            ''', (str(identifier),)).fetchone()
            if row is None:
                return None
            count = sum(normalize(r['sku']) == normalize(row['sku']) for r in connection.execute(
                'SELECT sku FROM product_variants'))
            return VariantSnapshot(
                variant_id=row['id'], parent_id=row['product_id'], sku=row['sku'], parent_sku=row['parent_sku'],
                attributes={key: row[key] for key in ('color', 'color_hex', 'size', 'model')},
                active=bool(row['is_active']), parent_active=row['parent_status'] == 'ACTIVE',
                price=money(row['price']), promotional_price=money(row['promotional_price']),
                available=row['quantity_available'], reserved=row['quantity_reserved'], normalized_sku_count=count,
            )

    def diagnostics(self) -> dict:
        with readonly_connection(self.path) as connection:
            return catalog_diagnostics(
                [dict(row) for row in connection.execute('SELECT id, status FROM products')],
                [dict(row) for row in connection.execute('SELECT id, product_id, sku, is_active FROM product_variants')],
            )
