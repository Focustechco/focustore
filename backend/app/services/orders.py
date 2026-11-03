"""Ownership-filtered, read-only access; Prisma remains the order writer."""
from pathlib import Path
import sqlite3
from decimal import InvalidOperation

from pydantic import ValidationError

from app.integrations.prisma_sqlite import readonly_connection, prisma_datetime
from app.integrations.legacy_catalog.mapper import money
from app.schemas.orders import OrderDetail, OrderLine, OrderPage, OrderSummary
from app.services.management import DomainError


class OrdersUnavailable(Exception):
    pass


COLUMNS = '''id, order_number, status, CAST(subtotal AS TEXT) AS subtotal,
    CAST(discount_amount AS TEXT) AS discount_amount,
    CAST(shipping_amount AS TEXT) AS shipping_amount, CAST(total AS TEXT) AS total,
    created_at, updated_at'''


def summary(row) -> OrderSummary:
    data = dict(row)
    for key in ('subtotal', 'discount_amount', 'shipping_amount', 'total'):
        data[key] = money(data[key])
    for key in ('created_at', 'updated_at'):
        data[key] = prisma_datetime(data[key])
    return OrderSummary(**data)


class OrderReader:
    def __init__(self, path: Path | None):
        self.path = path

    def _source(self):
        if self.path is None:
            raise OrdersUnavailable
        return readonly_connection(self.path)

    def list(self, user_id: str, offset: int, limit: int) -> OrderPage:
        try:
            with self._source() as connection:
                total = connection.execute('SELECT count(*) FROM orders WHERE user_id = ?', (user_id,)).fetchone()[0]
                rows = connection.execute(f'''SELECT {COLUMNS} FROM orders WHERE user_id = ?
                    ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?''', (user_id, limit, offset)).fetchall()
                return OrderPage(items=[summary(row) for row in rows], total=total, offset=offset, limit=limit)
        except (sqlite3.Error, OSError, ValueError, InvalidOperation, OverflowError, ValidationError) as exc:
            raise OrdersUnavailable from exc

    def detail(self, user_id: str, order_id: str) -> OrderDetail:
        try:
            with self._source() as connection:
                row = connection.execute(f'SELECT {COLUMNS} FROM orders WHERE id = ? AND user_id = ?',
                                         (order_id, user_id)).fetchone()
                if row is None:
                    raise DomainError(404, 'Pedido não encontrado.')
                rows = connection.execute('''
                    SELECT id, variant_id, product_name, variant_name, sku,
                           CAST(unit_price AS TEXT) AS unit_price, quantity,
                           CAST(total_price AS TEXT) AS total_price, image_url
                    FROM order_items WHERE order_id = ? ORDER BY id
                ''', (order_id,)).fetchall()
                items = []
                for line in rows:
                    data = dict(line)
                    data['unit_price'] = money(data['unit_price'])
                    data['total_price'] = money(data['total_price'])
                    items.append(OrderLine(**data))
                return OrderDetail(**summary(row).model_dump(), items=items)
        except (sqlite3.Error, OSError, ValueError, InvalidOperation, OverflowError, ValidationError) as exc:
            raise OrdersUnavailable from exc
