
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (Index('ix_categories_active_position', 'is_active', 'position'),)

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )

    slug: Mapped[str] = mapped_column(
        String(140),
        unique=True,
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey('categories.id', name='fk_categories_parent_id', ondelete='SET NULL'),
        nullable=True,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default='0')
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default='true')
    created_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(nullable=False, server_default=func.now(), onupdate=func.now())

    parent: Mapped['Category | None'] = relationship(
        'Category', remote_side=[id], back_populates='children'
    )
    children: Mapped[list['Category']] = relationship('Category', back_populates='parent')
    products: Mapped[list['Product']] = relationship(
        'Product', secondary='product_categories', back_populates='categories'
    )
    primary_products: Mapped[list['Product']] = relationship(
        'Product', back_populates='category', foreign_keys='Product.category_id'
    )
