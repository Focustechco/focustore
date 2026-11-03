"""Quote the existing catalog without creating carts, orders or reservations."""
from decimal import Decimal, InvalidOperation
from pathlib import Path
import sqlite3

from pydantic import ValidationError

from app.integrations.prisma_sqlite import readonly_connection
from app.integrations.legacy_catalog.mapper import money
from app.schemas.cart import Availability, CartQuote, CartQuoteInput, QuotedLine
from app.services.catalog_service import CatalogUnavailable
from app.services.management import DomainError


class CartService:
    def __init__(self, path: Path | None):
        self.path = path

    def _variants(self, identifiers: list[str]) -> dict:
        if self.path is None:
            raise CatalogUnavailable
        if not identifiers:
            return {}
        placeholders = ','.join('?' for _ in identifiers)
        try:
            with readonly_connection(self.path) as connection:
                rows = connection.execute(f'''
                    SELECT v.id, v.product_id, v.name, v.sku, p.name AS product_name,
                           CAST(v.price AS TEXT) AS price,
                           CAST(v.promotional_price AS TEXT) AS promotional_price,
                           i.quantity_available
                    FROM product_variants v JOIN products p ON p.id = v.product_id
                    LEFT JOIN inventory i ON i.variant_id = v.id
                    WHERE v.id IN ({placeholders}) AND v.is_active = 1 AND p.status = 'ACTIVE'
                ''', identifiers).fetchall()
                result = {}
                for row in rows:
                    data = dict(row)
                    data['unit_price'] = money(row['promotional_price'] if row['promotional_price'] is not None else row['price'])
                    if data['unit_price'] is None:
                        raise ValueError('Missing source price')
                    quantity = row['quantity_available']
                    if quantity is not None and (not isinstance(quantity, int) or quantity < 0):
                        raise ValueError('Invalid source stock')
                    result[row['id']] = data
                return result
        except (sqlite3.Error, OSError, ValueError, InvalidOperation) as exc:
            raise CatalogUnavailable from exc

    def quote(self, request: CartQuoteInput) -> CartQuote:
        quantities: dict[str, int] = {}
        for line in request.items:
            quantities[line.variant_id] = quantities.get(line.variant_id, 0) + line.quantity
            if quantities[line.variant_id] > 999:
                raise DomainError(422, 'Quantidade acumulada excede o limite por variante.')
        variants = self._variants(list(quantities)) if quantities else {}
        lines = []
        for identifier, quantity in quantities.items():
            row = variants.get(identifier)
            if row is None:
                raise DomainError(404, 'Variante ativa não encontrada.')
            if row['quantity_available'] is None or quantity > row['quantity_available']:
                raise DomainError(409, 'Estoque insuficiente para a quantidade solicitada.')
            try:
                line = QuotedLine(
                    variant_id=identifier, product_id=row['product_id'],
                    product_name=row['product_name'], variant_name=row['name'], sku=row['sku'],
                    quantity=quantity, unit_price=row['unit_price'],
                    line_total=row['unit_price'] * quantity,
                )
            except ValidationError as exc:
                raise CatalogUnavailable from exc
            lines.append(line)
        return CartQuote(items=lines, total_items=sum(quantities.values()),
                         subtotal=sum((line.line_total for line in lines), Decimal('0.00')))

    def availability(self, identifier: str) -> Availability:
        row = self._variants([identifier]).get(identifier)
        if row is None:
            raise DomainError(404, 'Variante ativa não encontrada.')
        available = row['quantity_available'] or 0
        return Availability(variant_id=identifier, quantity_available=available, available=available > 0)
