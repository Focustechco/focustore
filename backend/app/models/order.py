"""PostgreSQL-owned checkout records.

These tables are intentionally separate from the Prisma/SQLite order writer.
They become usable only when the explicit FastAPI checkout flag is enabled.
"""

from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, Uuid, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


ORDER_STATES = "'pending_payment', 'paid', 'cancelled', 'expired'"
PAYMENT_STATES = "'pending', 'paid', 'failed', 'cancelled'"


class Order(Base):
    __tablename__ = 'orders'
    __table_args__ = (
        UniqueConstraint('public_id', name='uq_orders_public_id'),
        UniqueConstraint('idempotency_scope', 'idempotency_key', name='uq_orders_idempotency'),
        CheckConstraint(f"status IN ({ORDER_STATES})", name='ck_orders_status'),
        CheckConstraint('subtotal >= 0 AND discount_amount >= 0 AND shipping_amount >= 0 AND total >= 0',
                        name='ck_orders_amounts_nonnegative'),
        Index('ix_orders_customer_created', 'customer_id', 'created_at', 'id'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, default=uuid4)
    customer_id: Mapped[str] = mapped_column(String(255), nullable=False)
    idempotency_scope: Mapped[str] = mapped_column(String(320), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(200), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    reservation_id: Mapped[int] = mapped_column(
        ForeignKey('stock_reservations.id', ondelete='RESTRICT'), nullable=False, unique=True
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default='pending_payment', server_default='pending_payment')
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default='BRL', server_default='BRL')
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal('0.00'), server_default='0')
    shipping_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal('0.00'), server_default='0')
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    shipping_option: Mapped[str] = mapped_column(String(160), nullable=False)
    shipping_address: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    reservation = relationship('StockReservation', back_populates='order')
    items: Mapped[list['OrderItem']] = relationship('OrderItem', back_populates='order', cascade='all, delete-orphan', order_by='OrderItem.id')
    payments: Mapped[list['PaymentAttempt']] = relationship('PaymentAttempt', back_populates='order', cascade='all, delete-orphan', order_by='PaymentAttempt.id')
    history: Mapped[list['OrderStatusHistory']] = relationship('OrderStatusHistory', back_populates='order', cascade='all, delete-orphan', order_by='OrderStatusHistory.id')
    outbox_events: Mapped[list['OrderOutboxEvent']] = relationship('OrderOutboxEvent', back_populates='order', cascade='all, delete-orphan')


class OrderItem(Base):
    __tablename__ = 'order_items'
    __table_args__ = (
        CheckConstraint('quantity > 0', name='ck_order_items_quantity_positive'),
        CheckConstraint('unit_price >= 0 AND line_total >= 0', name='ck_order_items_amounts_nonnegative'),
        Index('ix_order_items_variant', 'variant_id'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey('orders.id', ondelete='CASCADE'), nullable=False)
    variant_id: Mapped[int] = mapped_column(ForeignKey('product_variants.id', ondelete='RESTRICT'), nullable=False)
    variant_public_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    product_name: Mapped[str] = mapped_column(String(150), nullable=False)
    variant_name: Mapped[str] = mapped_column(String(150), nullable=False)
    sku: Mapped[str] = mapped_column(String(120), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    order: Mapped[Order] = relationship('Order', back_populates='items')


class PaymentAttempt(Base):
    __tablename__ = 'payment_attempts'
    __table_args__ = (
        CheckConstraint(f"status IN ({PAYMENT_STATES})", name='ck_payment_attempts_status'),
        CheckConstraint('amount >= 0', name='ck_payment_attempts_amount_nonnegative'),
        Index('ix_payment_attempts_order_created', 'order_id', 'created_at'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey('orders.id', ondelete='CASCADE'), nullable=False)
    provider: Mapped[str] = mapped_column(String(80), nullable=False)
    method: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default='pending', server_default='pending')
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    provider_payment_id: Mapped[str | None] = mapped_column(String(255), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    order: Mapped[Order] = relationship('Order', back_populates='payments')


class OrderStatusHistory(Base):
    __tablename__ = 'order_status_history'
    __table_args__ = (Index('ix_order_status_history_order_created', 'order_id', 'created_at'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey('orders.id', ondelete='CASCADE'), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    order: Mapped[Order] = relationship('Order', back_populates='history')


class OrderOutboxEvent(Base):
    __tablename__ = 'order_outbox_events'
    __table_args__ = (
        UniqueConstraint('event_key', name='uq_order_outbox_event_key'),
        Index('ix_order_outbox_pending', 'published_at', 'created_at'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey('orders.id', ondelete='CASCADE'), nullable=False)
    event_key: Mapped[str] = mapped_column(String(320), nullable=False)
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    order: Mapped[Order] = relationship('Order', back_populates='outbox_events')
