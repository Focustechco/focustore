from decimal import Decimal

from sqlalchemy import and_, cast, func, or_, select, String
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.category import Category
from app.models.product import Product, ProductVariant
from app.schemas.catalog import CatalogCategory, CatalogPage, CatalogProduct, CatalogSort
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

    def products(
        self,
        offset: int,
        limit: int,
        *,
        search: str | None = None,
        category_slug: str | None = None,
        sort: CatalogSort = 'relevance',
        min_price: Decimal | None = None,
        max_price: Decimal | None = None,
    ) -> CatalogPage[CatalogProduct]:
        base = select(Product).where(Product.status == 'ACTIVE')
        if search:
            escaped = search.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
            pattern = f'%{escaped}%'
            base = base.where(or_(
                Product.name.ilike(pattern, escape='\\'),
                Product.description.ilike(pattern, escape='\\'),
                Product.brand.ilike(pattern, escape='\\'),
            ))
        if category_slug and category_slug != 'todos':
            base = base.where(Product.categories.any(and_(
                Category.slug == category_slug,
                Category.is_active.is_(True),
            )))
        price = func.coalesce(Product.base_price, Product.price)
        if min_price is not None:
            base = base.where(price >= min_price)
        if max_price is not None:
            base = base.where(price <= max_price)
        total = self.db.scalar(select(func.count()).select_from(base.subquery())) or 0
        if sort == 'price_asc':
            ordering = (price.asc(), Product.slug, Product.id)
        elif sort == 'price_desc':
            ordering = (price.desc(), Product.slug, Product.id)
        elif sort == 'newest':
            ordering = (Product.created_at.desc(), Product.id.desc())
        else:
            ordering = (Product.slug, Product.id)
        statement = base.options(*self._product_options()).order_by(*ordering).offset(offset).limit(limit)
        items = [product_schema(product) for product in self.db.scalars(statement).unique().all()]
        return CatalogPage(items=items, total=total, offset=offset, limit=limit)

    def product(self, slug: str) -> CatalogProduct | None:
        statement = (
            select(Product)
            .where(Product.slug == slug, Product.status == 'ACTIVE')
            .options(*self._product_options())
        )
        product = self.db.scalars(statement).unique().first()
        if product is None:
            legacy_slug = (
                select(Product)
                .where(
                    Product.slug.is_(None),
                    Product.status == 'ACTIVE',
                    and_(
                        func.concat('legacy-product-', cast(Product.id, String)) == slug,
                    ),
                )
                .options(*self._product_options())
            )
            product = self.db.scalars(legacy_slug).unique().first()
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
