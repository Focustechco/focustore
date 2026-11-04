from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.category import Category
from app.models.product import Product, ProductVariant
from app.schemas.catalog import CatalogCategory, CatalogPage, CatalogProduct
from app.integrations.postgres_catalog.mapper import category_schema, product_schema


class PostgresCatalogRepository:
    """Read-only catalog queries backed by the Alembic-owned PostgreSQL schema."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def _product_options(self):
        return (
            selectinload(Product.images),
            selectinload(Product.variants).joinedload(ProductVariant.inventory),
            selectinload(Product.categories),
            joinedload(Product.category),
        )

    def products(self, offset: int, limit: int) -> CatalogPage[CatalogProduct]:
        base = select(Product).where(Product.status == 'ACTIVE')
        total = self.db.scalar(select(func.count()).select_from(base.subquery())) or 0
        statement = base.options(*self._product_options()).order_by(Product.slug, Product.id).offset(offset).limit(limit)
        items = [product_schema(product) for product in self.db.scalars(statement).unique().all()]
        return CatalogPage(items=items, total=total, offset=offset, limit=limit)

    def product(self, slug: str) -> CatalogProduct | None:
        statement = (
            select(Product)
            .where(Product.slug == slug, Product.status == 'ACTIVE')
            .options(*self._product_options())
        )
        product = self.db.scalars(statement).unique().first()
        return product_schema(product) if product else None

    def categories(self, offset: int, limit: int) -> CatalogPage[CatalogCategory]:
        base = select(Category).where(Category.is_active.is_(True))
        total = self.db.scalar(select(func.count()).select_from(base.subquery())) or 0
        statement = base.order_by(Category.position, Category.id).offset(offset).limit(limit)
        items = [category_schema(category) for category in self.db.scalars(statement).all()]
        return CatalogPage(items=items, total=total, offset=offset, limit=limit)

    def category(self, slug: str) -> CatalogCategory | None:
        category = self.db.scalar(
            select(Category).where(Category.slug == slug, Category.is_active.is_(True))
        )
        return category_schema(category) if category else None
