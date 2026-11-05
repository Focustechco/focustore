"""Use cases for the existing SQLAlchemy catalog, separate from Prisma IDs."""

import re
import unicodedata
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.product import Product, ProductCategory


class DomainError(Exception):
    def __init__(self, status: int, detail: str):
        self.status = status
        self.detail = detail


LEGACY_SLUG_PATTERN = re.compile(r"^legacy-product-\d+$")


def product_slug(name: str) -> str:
    """Create a stable, URL-safe slug while reserving legacy fallback names."""
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-") or "produto"
    if LEGACY_SLUG_PATTERN.fullmatch(slug):
        slug = f"{slug}-item"
    return slug[:180].rstrip("-")


def _is_slug_conflict(exc: IntegrityError) -> bool:
    original = getattr(exc, "orig", None)
    diagnostic = getattr(original, "diag", None)
    constraint = getattr(diagnostic, "constraint_name", None)
    if constraint == "ux_products_slug":
        return True
    return "slug" in str(original).lower()


def required(db: Session, model, identifier: int, *, lock: bool = False):
    resource = db.get(model, identifier, with_for_update=True if lock else None)
    if resource is None:
        label = 'Categoria' if model is Category else 'Produto'
        raise DomainError(404, f'{label} não encontrad{"a" if model is Category else "o"}.')
    return resource


def save(db: Session, resource):
    try:
        db.add(resource)
        db.commit()
        db.refresh(resource)
    except IntegrityError as exc:
        db.rollback()
        detail = ('Já existe uma categoria com esse slug.' if isinstance(resource, Category)
                  else 'Dados conflitantes ou categoria indisponível.')
        raise DomainError(409, detail) from exc
    return resource


def create_product(db: Session, values: dict):
    required(db, Category, values['category_id'])
    base_slug = product_slug(values["name"])
    for suffix in range(0, 1000):
        slug = base_slug if suffix == 0 else f"{base_slug[:170].rstrip('-')}-{suffix + 1}"
        try:
            product = Product(**values, slug=slug)
            db.add(product)
            db.commit()
            db.refresh(product)
            return product
        except IntegrityError as exc:
            db.rollback()
            if not _is_slug_conflict(exc):
                raise DomainError(409, 'Dados conflitantes ou categoria indisponível.') from exc
    raise DomainError(409, 'Não foi possível gerar um slug exclusivo para o produto.')


def update_product(db: Session, identifier: int, values: dict):
    product = required(db, Product, identifier, lock=True)
    if 'category_id' in values:
        required(db, Category, values['category_id'])
    for key, value in values.items():
        setattr(product, key, value)
    return save(db, product)


def update_category(db: Session, identifier: int, values: dict):
    category = required(db, Category, identifier)
    for key, value in values.items():
        setattr(category, key, value)
    return save(db, category)


def delete_resource(db: Session, model, identifier: int):
    resource = required(db, model, identifier)
    if model is Category:
        linked_product = db.scalar(
            select(Product.id)
            .outerjoin(ProductCategory, ProductCategory.product_id == Product.id)
            .where(
                or_(
                    Product.category_id == identifier,
                    ProductCategory.category_id == identifier,
                )
            )
            .limit(1)
        )
        if linked_product is not None:
            raise DomainError(409, 'Categoria possui produtos vinculados.')
    try:
        db.delete(resource)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise DomainError(409, 'Recurso possui vínculos e não pode ser excluído.') from exc


def adjust_stock(db: Session, identifier: int, delta: int):
    """Single guarded UPDATE: concurrent decrements cannot make stock negative."""
    from sqlalchemy import BigInteger, cast, update
    required(db, Product, identifier)
    next_stock = cast(Product.stock, BigInteger) + delta
    result = db.execute(
        update(Product).where(
            Product.id == identifier, next_stock >= 0,
            next_stock <= 2147483647,
        ).values(stock=next_stock).execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.rollback()
        raise DomainError(409, 'Ajuste excede os limites de estoque.')
    db.commit()
    db.expire_all()
    return required(db, Product, identifier)
