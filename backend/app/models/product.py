from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Product(Base):
    __tablename__ = "products"

    __table_args__ = (
        CheckConstraint("price > 0", name="ck_products_price_positive"),
        CheckConstraint("stock >= 0", name="ck_products_stock_nonnegative"),
        CheckConstraint("base_price IS NULL OR base_price >= 0", name="ck_products_base_price_nonnegative"),
        Index('ux_products_slug', 'slug', unique=True),
        Index('ux_products_sku', 'sku', unique=True),
        Index('ix_products_catalog_status', 'status', 'slug'),
        UniqueConstraint('public_id', name='uq_products_public_id'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # PostgreSQL stores this generic SQLAlchemy UUID as its native UUID type.
    # The integer primary key remains the internal relational identity.
    public_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, default=uuid4)

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    stock: Mapped[int] = mapped_column(
        nullable=False,
        default=0,
    )

    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id"),
        nullable=False,
    )

    slug: Mapped[str | None] = mapped_column(String(180), nullable=True)
    sku: Mapped[str | None] = mapped_column(String(120), nullable=True)
    short_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    brand: Mapped[str] = mapped_column(String(120), nullable=False, default='Focus', server_default='Focus')
    base_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    promotional_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default='ACTIVE', server_default='ACTIVE')
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default='false')
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), onupdate=func.now())

    category: Mapped['Category'] = relationship(
        'Category', back_populates='primary_products', foreign_keys=[category_id]
    )
    categories: Mapped[list['Category']] = relationship(
        'Category', secondary='product_categories', back_populates='products'
    )
    images: Mapped[list['ProductImage']] = relationship(
        'ProductImage', back_populates='product', cascade='all, delete-orphan', order_by='ProductImage.position'
    )
    variants: Mapped[list['ProductVariant']] = relationship(
        'ProductVariant', back_populates='product', cascade='all, delete-orphan', order_by='ProductVariant.position'
    )


class ProductCategory(Base):
    __tablename__ = 'product_categories'
    __table_args__ = (Index('ix_product_categories_category_id', 'category_id'),)

    product_id: Mapped[int] = mapped_column(ForeignKey('products.id', ondelete='CASCADE'), primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey('categories.id', ondelete='CASCADE'), primary_key=True)


class ProductImage(Base):
    __tablename__ = 'product_images'
    __table_args__ = (Index('ix_product_images_product_position', 'product_id', 'position'),)

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id', ondelete='CASCADE'), nullable=False)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    alt_text: Mapped[str | None] = mapped_column(String(300), nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default='0')
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default='false')

    product: Mapped[Product] = relationship('Product', back_populates='images')


class ProductVariant(Base):
    __tablename__ = 'product_variants'
    __table_args__ = (
        Index('ix_product_variants_product_position', 'product_id', 'position'),
        UniqueConstraint('sku', name='uq_product_variants_sku'),
        CheckConstraint('price >= 0', name='ck_product_variants_price_nonnegative'),
        CheckConstraint(
            'promotional_price IS NULL OR promotional_price <= price',
            name='ck_product_variants_promo_not_above_price',
        ),
        UniqueConstraint('public_id', name='uq_product_variants_public_id'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Independent from the integer primary key and any external catalog source.
    public_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, default=uuid4)
    product_id: Mapped[int] = mapped_column(ForeignKey('products.id', ondelete='CASCADE'), nullable=False)
    sku: Mapped[str] = mapped_column(String(120), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    color: Mapped[str | None] = mapped_column(String(80), nullable=True)
    color_hex: Mapped[str | None] = mapped_column(String(20), nullable=True)
    size: Mapped[str | None] = mapped_column(String(40), nullable=True)
    model: Mapped[str | None] = mapped_column(String(80), nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    promotional_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default='0')
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default='true')
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), onupdate=func.now())

    product: Mapped[Product] = relationship('Product', back_populates='variants')
    inventory: Mapped['Inventory | None'] = relationship(
        'Inventory', back_populates='variant', uselist=False, cascade='all, delete-orphan'
    )


class Inventory(Base):
    __tablename__ = 'inventory'
    __table_args__ = (
        CheckConstraint('quantity_available >= 0', name='ck_inventory_available_nonnegative'),
        CheckConstraint('quantity_reserved >= 0', name='ck_inventory_reserved_nonnegative'),
        UniqueConstraint('variant_id', name='uq_inventory_variant_id'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    variant_id: Mapped[int] = mapped_column(
        ForeignKey('product_variants.id', ondelete='CASCADE'), nullable=False, unique=True
    )
    quantity_available: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default='0')
    quantity_reserved: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default='0')
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), onupdate=func.now())

    variant: Mapped[ProductVariant] = relationship('ProductVariant', back_populates='inventory')


class StockReservation(Base):
    __tablename__ = 'stock_reservations'
    __table_args__ = (
        UniqueConstraint('idempotency_scope', 'idempotency_key', name='uq_stock_reservation_idempotency'),
        CheckConstraint("status IN ('pending', 'confirmed', 'released', 'expired')", name='ck_stock_reservation_status'),
        CheckConstraint('length(trim(idempotency_scope)) > 0', name='ck_stock_reservation_scope'),
        CheckConstraint('length(trim(idempotency_key)) > 0', name='ck_stock_reservation_key'),
        Index('ix_stock_reservation_status_expiry', 'status', 'expires_at'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, default=uuid4, unique=True)
    idempotency_scope: Mapped[str] = mapped_column(String(120), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(200), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default='pending', server_default='pending')
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), onupdate=func.now())

    items: Mapped[list['StockReservationItem']] = relationship(
        'StockReservationItem', back_populates='reservation', cascade='all, delete-orphan', order_by='StockReservationItem.id'
    )


class StockReservationItem(Base):
    __tablename__ = 'stock_reservation_items'
    __table_args__ = (
        UniqueConstraint('reservation_id', 'variant_id', name='uq_stock_reservation_item_variant'),
        CheckConstraint('quantity > 0', name='ck_stock_reservation_item_quantity_positive'),
        Index('ix_stock_reservation_items_variant', 'variant_id'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    reservation_id: Mapped[int] = mapped_column(ForeignKey('stock_reservations.id', ondelete='RESTRICT'), nullable=False)
    variant_id: Mapped[int] = mapped_column(ForeignKey('product_variants.id', ondelete='RESTRICT'), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    reservation: Mapped[StockReservation] = relationship('StockReservation', back_populates='items')
    variant: Mapped[ProductVariant] = relationship('ProductVariant')


class InventoryMovement(Base):
    __tablename__ = 'inventory_movements'
    __table_args__ = (
        UniqueConstraint('reservation_id', 'variant_id', 'operation', name='uq_inventory_movement_operation'),
        CheckConstraint("operation IN ('reserve', 'confirm', 'release', 'expire')", name='ck_inventory_movement_operation'),
        CheckConstraint('quantity > 0', name='ck_inventory_movement_quantity_positive'),
        Index('ix_inventory_movements_variant_time', 'variant_id', 'occurred_at'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    inventory_id: Mapped[int] = mapped_column(ForeignKey('inventory.id', ondelete='RESTRICT'), nullable=False)
    reservation_id: Mapped[int] = mapped_column(ForeignKey('stock_reservations.id', ondelete='RESTRICT'), nullable=False)
    variant_id: Mapped[int] = mapped_column(ForeignKey('product_variants.id', ondelete='RESTRICT'), nullable=False)
    operation: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(120), nullable=False)
    transaction_reference: Mapped[str] = mapped_column(String(200), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
