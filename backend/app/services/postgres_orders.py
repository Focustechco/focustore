"""Transactional PostgreSQL order creation and owner-filtered history."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.models.order import Order, OrderItem
from app.models.product import Product, ProductVariant
from app.schemas.orders import OrderCreateInput, OrderDetail, OrderLine, OrderPage, OrderSummary
from app.services.management import DomainError
from app.services.orders import OrdersUnavailable


def _available(variant: ProductVariant) -> int:
    inventory = variant.inventory
    if inventory is None:
        return 0
    return max(0, inventory.quantity_available - inventory.quantity_reserved)


def _summary(order: Order) -> OrderSummary:
    return OrderSummary(
        id=order.id,
        order_number=order.order_number,
        status=order.status,
        subtotal=order.subtotal,
        discount_amount=Decimal('0.00'),
        shipping_amount=Decimal('0.00'),
        total=order.total,
        currency=order.currency,
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


def _detail(order: Order) -> OrderDetail:
    return OrderDetail(
        **_summary(order).model_dump(),
        items=[OrderLine(
            id=item.id,
            variant_id=str(item.variant_id),
            product_id=str(item.product_id),
            product_name=item.product_name,
            variant_name=item.variant_name,
            sku=item.sku,
            unit_price=item.unit_price,
            quantity=item.quantity,
            total_price=item.subtotal,
            image_url=item.image_url,
        ) for item in order.items],
    )


class PostgresOrderService:
    def __init__(self, db: Session):
        self.db = db

    def create(self, user_id: str, request: OrderCreateInput) -> OrderDetail:
        quantities: dict[int, int] = {}
        for line in request.items:
            try:
                variant_id = int(line.variant_id)
            except ValueError as exc:
                raise DomainError(404, 'Variante não encontrada.') from exc
            quantities[variant_id] = quantities.get(variant_id, 0) + line.quantity
            if quantities[variant_id] > 999:
                raise DomainError(422, 'Quantidade acumulada excede o limite por variante.')

        try:
            result: OrderDetail | None = None
            with self.db.begin_nested():
                if request.idempotency_key:
                    existing = self.db.scalar(select(Order).where(Order.idempotency_key == request.idempotency_key))
                    if existing is not None:
                        if existing.user_id != user_id:
                            raise DomainError(409, 'A chave de idempotência já está associada a outro pedido.')
                        self.db.refresh(existing)
                        result = _detail(existing)

                if result is None:
                    variants = self.db.scalars(
                        select(ProductVariant)
                        .join(ProductVariant.product)
                        .where(
                            ProductVariant.id.in_(list(quantities)),
                            ProductVariant.is_active.is_(True),
                            Product.status == 'ACTIVE',
                        )
                        .options(
                            # Keep FOR UPDATE on the variant query itself. PostgreSQL
                            # rejects FOR UPDATE when joinedload emits nullable-side
                            # outer joins for the optional inventory row.
                            selectinload(ProductVariant.product),
                            selectinload(ProductVariant.inventory),
                        )
                        .with_for_update()
                    ).unique().all()
                    by_id = {variant.id: variant for variant in variants}
                    if len(by_id) != len(quantities):
                        raise DomainError(404, 'Produto ou variante indisponível.')

                    lines: list[OrderItem] = []
                    subtotal = Decimal('0.00')
                    for variant_id, quantity in quantities.items():
                        variant = by_id[variant_id]
                        available = _available(variant)
                        if quantity > available:
                            raise DomainError(409, f'Estoque insuficiente para {variant.name}.')
                        unit_price = variant.promotional_price if variant.promotional_price is not None else variant.price
                        line_subtotal = unit_price * quantity
                        subtotal += line_subtotal
                        lines.append(OrderItem(
                            product_id=variant.product_id,
                            variant_id=variant.id,
                            product_name=variant.product.name,
                            variant_name=variant.name,
                            sku=variant.sku,
                            quantity=quantity,
                            unit_price=unit_price,
                            subtotal=line_subtotal,
                            image_url=variant.image_url,
                        ))

                    order = Order(
                        user_id=user_id,
                        order_number=f"FS-{datetime.now(timezone.utc).year}-{uuid4().hex[:10].upper()}",
                        status='PENDING_PAYMENT',
                        currency='BRL',
                        subtotal=subtotal,
                        total=subtotal,
                        idempotency_key=request.idempotency_key,
                        items=lines,
                    )
                    self.db.add(order)
                    self.db.flush()
                    self.db.refresh(order)
                    result = _detail(order)
            self.db.commit()
            assert result is not None
            return result
        except DomainError:
            raise
        except IntegrityError as exc:
            self.db.rollback()
            if request.idempotency_key:
                existing = self.db.scalar(select(Order).where(Order.idempotency_key == request.idempotency_key))
                if existing is not None and existing.user_id == user_id:
                    self.db.refresh(existing)
                    return _detail(existing)
            raise DomainError(409, 'Não foi possível criar o pedido.') from exc
        except SQLAlchemyError as exc:
            self.db.rollback()
            raise OrdersUnavailable from exc

    def list(self, user_id: str, offset: int, limit: int) -> OrderPage:
        try:
            total = self.db.scalar(select(func.count()).select_from(Order).where(Order.user_id == user_id)) or 0
            orders = self.db.scalars(
                select(Order).where(Order.user_id == user_id)
                .order_by(Order.created_at.desc(), Order.id.desc())
                .offset(offset).limit(limit)
            ).all()
            return OrderPage(items=[_summary(order) for order in orders], total=total, offset=offset, limit=limit)
        except SQLAlchemyError as exc:
            raise OrdersUnavailable from exc

    def detail(self, user_id: str, order_id: str) -> OrderDetail:
        try:
            order = self.db.scalar(
                select(Order).where(Order.id == order_id, Order.user_id == user_id)
                .options(selectinload(Order.items))
            )
            if order is None:
                raise DomainError(404, 'Pedido não encontrado.')
            return _detail(order)
        except DomainError:
            raise
        except SQLAlchemyError as exc:
            raise OrdersUnavailable from exc
