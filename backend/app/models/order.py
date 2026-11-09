"""PostgreSQL order snapshots owned by authenticated customers."""

from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Order(Base):
    __tablename__ = 'orders'
    __table_args__ = (
        UniqueConstraint('order_number', name='uq_orders_order_number'),
        UniqueConstraint('idempotency_key', name='uq_orders_idempotency_key'),
        Index('ix_orders_user_created', 'user_id', 'created_at'),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey('users.id', ondelete='RESTRICT'), nullable=False
    )
    order_number: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default='PENDING_PAYMENT')
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default='BRL', server_default='BRL')
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    items: Mapped[list['OrderItem']] = relationship(
        'OrderItem', back_populates='order', cascade='all, delete-orphan', order_by='OrderItem.id'
    )


class OrderItem(Base):
    __tablename__ = 'order_items'
    __table_args__ = (
        Index('ix_order_items_order_id', 'order_id'),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey('orders.id', ondelete='CASCADE'), nullable=False
    )
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id', ondelete='RESTRICT'), nullable=False)
    variant_id: Mapped[int] = mapped_column(ForeignKey('product_variants.id', ondelete='RESTRICT'), nullable=False)
    product_name: Mapped[str] = mapped_column(String(150), nullable=False)
    variant_name: Mapped[str] = mapped_column(String(150), nullable=False)
    sku: Mapped[str] = mapped_column(String(120), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    order: Mapped[Order] = relationship('Order', back_populates='items')
