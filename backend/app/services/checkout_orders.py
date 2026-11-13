"""Transactional PostgreSQL checkout and order state transitions.

This service is not connected to the Prisma writer.  It is intentionally
fail-closed until a deployment explicitly selects PostgreSQL catalog and a
real payment provider contract.  Tests may enable the simulator locally.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.config import Settings
from app.models.order import Order, OrderItem, OrderOutboxEvent, OrderStatusHistory, PaymentAttempt
from app.models.product import Product, ProductVariant, StockReservation
from app.services.inventory_reservations import InventoryReservationService, ReservationError, ReservationLine
from app.services.management import DomainError
from app.services.shipping import selected


CENT = Decimal('0.01')


def money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


class CheckoutOrderService:
    def __init__(self, db: Session, settings: Settings):
        self.db = db
        self.settings = settings

    @staticmethod
    def _scope(customer_id: str) -> str:
        return f'customer:{customer_id}'

    @staticmethod
    def _hash(payload: dict) -> str:
        return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(',', ':'), default=str).encode()).hexdigest()

    @staticmethod
    def _canonical_items(data) -> list:
        if len({line.variant_id for line in data.items}) != len(data.items):
            raise DomainError(422, 'Cada variante deve aparecer apenas uma vez.')
        return sorted(data.items, key=lambda line: str(line.variant_id))

    def _ensure_enabled(self) -> None:
        if not self.settings.fastapi_checkout_enabled or self.settings.catalog_source != 'postgresql':
            raise DomainError(404, 'Checkout FastAPI indisponível nesta implantação.')
        if not self.settings.fastapi_payment_simulator_enabled or not self.settings.debug:
            raise DomainError(503, 'Nenhum provedor de pagamento FastAPI foi configurado.')

    def create(self, customer_id: str, data) -> Order:
        self._ensure_enabled()
        lines = self._canonical_items(data)
        scope = self._scope(customer_id)
        request_payload = {
            'items': [(str(line.variant_id), line.quantity) for line in lines],
            'shipping_address': data.shipping_address.model_dump(mode='json'),
            'shipping_option': data.shipping_option.model_dump(mode='json'),
            'payment_method': data.payment_method,
        }
        request_hash = self._hash(request_payload)

        for attempt in range(2):
            try:
                with self.db.begin():
                    existing = self._find_order(scope, data.idempotency_key)
                    if existing is not None:
                        self._assert_same_request(existing, request_hash)
                        return existing

                    identifiers = [line.variant_id for line in lines]
                    variants = self.db.scalars(
                        select(ProductVariant).where(ProductVariant.public_id.in_(identifiers), ProductVariant.is_active.is_(True))
                        .join(Product, Product.id == ProductVariant.product_id)
                        .where(Product.status == 'ACTIVE')
                        .options(selectinload(ProductVariant.product))
                        .order_by(ProductVariant.id)
                    ).all()
                    by_public_id = {variant.public_id: variant for variant in variants}
                    if len(by_public_id) != len(lines):
                        raise DomainError(404, 'Uma ou mais variantes ativas não foram encontradas.')

                    item_values = []
                    subtotal = Decimal('0.00')
                    reservation_lines = []
                    for line in lines:
                        variant = by_public_id[line.variant_id]
                        unit_price = money(variant.promotional_price or variant.price)
                        line_total = money(unit_price * line.quantity)
                        subtotal += line_total
                        reservation_lines.append(ReservationLine(variant.public_id, line.quantity))
                        item_values.append({
                            'variant_id': variant.id,
                            'variant_public_id': variant.public_id,
                            'product_name': variant.product.name,
                            'variant_name': variant.name,
                            'sku': variant.sku,
                            'unit_price': unit_price,
                            'quantity': line.quantity,
                            'line_total': line_total,
                        })
                    subtotal = money(subtotal)
                    freight = selected(data.shipping_address.postal_code, subtotal,
                                       data.shipping_option.carrier, data.shipping_option.service_name)
                    total = money(subtotal + freight['amount'])
                    reservation = InventoryReservationService(
                        self.db, source='fastapi-checkout', idempotency_scope=scope,
                    ).create_in_transaction(data.idempotency_key, reservation_lines,
                                            ttl_seconds=self.settings.reservation_ttl_seconds)
                    reservation_row = self.db.scalar(
                        select(StockReservation).where(StockReservation.public_id == reservation.reservation_id)
                    )
                    if reservation_row is None:
                        raise DomainError(503, 'Reserva não encontrada após criação.')
                    order = Order(
                        customer_id=customer_id, idempotency_scope=scope, idempotency_key=data.idempotency_key,
                        request_hash=request_hash, reservation_id=reservation_row.id,
                        subtotal=subtotal, discount_amount=Decimal('0.00'), shipping_amount=freight['amount'],
                        total=total, shipping_option=f"{freight['carrier']}::{freight['service_name']}",
                        shipping_address=json.dumps(data.shipping_address.model_dump(mode='json'), sort_keys=True),
                    )
                    self.db.add(order)
                    self.db.flush()
                    self.db.add_all([OrderItem(order_id=order.id, **values) for values in item_values])
                    payment = PaymentAttempt(order_id=order.id, provider='test-simulator', method=data.payment_method,
                                            amount=total)
                    self.db.add(payment)
                    self._record(order, 'pending_payment', 'Pedido criado e reserva vinculada.')
                    self._event(order, 'OrderCreated', {'order_id': str(order.public_id), 'status': order.status})
                    self.db.flush()
                    return order
            except IntegrityError:
                self.db.rollback()
                if attempt == 0:
                    continue
                raise DomainError(409, 'O checkout concorrente não pôde ser reconciliado com segurança.')
            except ReservationError as exc:
                raise DomainError(409, str(exc)) from exc
        raise DomainError(409, 'O checkout não pôde ser concluído.')

    def _find_order(self, scope: str, key: str) -> Order | None:
        return self.db.scalar(select(Order).where(Order.idempotency_scope == scope, Order.idempotency_key == key)
                               .options(selectinload(Order.items), selectinload(Order.payments)))

    @staticmethod
    def _assert_same_request(order: Order, request_hash: str) -> None:
        if order.request_hash != request_hash:
            raise DomainError(409, 'A chave de idempotência já foi usada com outro pedido.')

    def list(self, customer_id: str, offset: int, limit: int) -> tuple[list[Order], int]:
        total = self.db.scalar(select(func.count()).select_from(Order).where(Order.customer_id == customer_id)) or 0
        rows = self.db.scalars(select(Order).where(Order.customer_id == customer_id)
                               .options(selectinload(Order.items), selectinload(Order.payments))
                               .order_by(Order.created_at.desc(), Order.id.desc()).offset(offset).limit(limit)).all()
        return rows, total

    def get(self, customer_id: str, public_id: UUID) -> Order:
        order = self.db.scalar(select(Order).where(Order.customer_id == customer_id, Order.public_id == public_id)
                               .options(selectinload(Order.items), selectinload(Order.payments)))
        if order is None:
            raise DomainError(404, 'Pedido não encontrado.')
        return order

    def transition_payment(self, customer_id: str, public_id: UUID, status: str) -> Order:
        self._ensure_enabled()
        if not self.settings.debug or not self.settings.fastapi_payment_simulator_enabled:
            raise DomainError(404, 'Simulador de pagamento indisponível.')
        try:
            with self.db.begin():
                order = self.db.scalar(select(Order).where(Order.customer_id == customer_id, Order.public_id == public_id)
                                       .options(selectinload(Order.items), selectinload(Order.payments), selectinload(Order.reservation))
                                       .with_for_update())
                if order is None:
                    raise DomainError(404, 'Pedido não encontrado.')
                if status == 'paid' and order.status == 'paid':
                    return order
                if status == 'failed' and order.status in {'cancelled', 'expired'}:
                    return order
                if order.status != 'pending_payment':
                    raise DomainError(409, 'Pedido não está aguardando pagamento.')
                payment = order.payments[0]
                reservation_service = InventoryReservationService(
                    self.db, source='fastapi-checkout', idempotency_scope=order.idempotency_scope,
                )
                if status == 'paid':
                    reservation_service.transition_in_transaction(order.reservation.public_id, 'confirmed')
                    order.status = 'paid'
                    payment.status = 'paid'
                    payment.paid_at = datetime.now(timezone.utc)
                    reason = 'Pagamento confirmado pelo simulador de testes.'
                    event_type = 'OrderPaid'
                else:
                    reservation_service.transition_in_transaction(order.reservation.public_id, 'released')
                    order.status = 'cancelled'
                    payment.status = 'failed'
                    reason = 'Pagamento recusado pelo simulador de testes.'
                    event_type = 'OrderCancelled'
                self._record(order, order.status, reason)
                self._event(order, event_type, {'order_id': str(order.public_id), 'status': order.status})
                self.db.flush()
                return order
        except ReservationError as exc:
            raise DomainError(409, str(exc)) from exc

    def cancel(self, customer_id: str, public_id: UUID) -> Order:
        self._ensure_enabled()
        try:
            with self.db.begin():
                order = self.db.scalar(select(Order).where(Order.customer_id == customer_id, Order.public_id == public_id)
                                       .options(selectinload(Order.payments), selectinload(Order.reservation)).with_for_update())
                if order is None:
                    raise DomainError(404, 'Pedido não encontrado.')
                if order.status == 'cancelled':
                    return order
                if order.status != 'pending_payment':
                    raise DomainError(409, 'Somente pedidos aguardando pagamento podem ser cancelados.')
                InventoryReservationService(self.db, source='fastapi-checkout', idempotency_scope=order.idempotency_scope) \
                    .transition_in_transaction(order.reservation.public_id, 'released')
                order.status = 'cancelled'
                order.payments[0].status = 'cancelled'
                self._record(order, 'cancelled', 'Cancelamento explícito do cliente.')
                self._event(order, 'OrderCancelled', {'order_id': str(order.public_id), 'status': order.status})
                self.db.flush()
                return order
        except ReservationError as exc:
            raise DomainError(409, str(exc)) from exc

    def expire(self, public_id: UUID) -> Order:
        """Expire one due order; intentionally not scheduled or exposed as HTTP."""
        with self.db.begin():
            order = self.db.scalar(select(Order).where(Order.public_id == public_id)
                                   .options(selectinload(Order.payments), selectinload(Order.reservation)).with_for_update())
            if order is None:
                raise DomainError(404, 'Pedido não encontrado.')
            if order.status == 'expired':
                return order
            if order.status != 'pending_payment':
                raise DomainError(409, 'Somente pedidos pendentes podem expirar.')
            try:
                InventoryReservationService(self.db, source='fastapi-checkout', idempotency_scope=order.idempotency_scope) \
                    .transition_in_transaction(order.reservation.public_id, 'expired')
            except ReservationError as exc:
                raise DomainError(409, str(exc)) from exc
            order.status = 'expired'
            order.payments[0].status = 'cancelled'
            self._record(order, 'expired', 'Prazo da reserva atingido.')
            self._event(order, 'OrderExpired', {'order_id': str(order.public_id), 'status': order.status})
            self.db.flush()
            return order

    def _record(self, order: Order, status: str, reason: str) -> None:
        self.db.add(OrderStatusHistory(order_id=order.id, status=status, reason=reason))

    def _event(self, order: Order, event_type: str, payload: dict) -> None:
        self.db.add(OrderOutboxEvent(order_id=order.id, event_key=f'{order.public_id}:{event_type}',
                                     event_type=event_type, payload=json.dumps(payload, sort_keys=True)))
