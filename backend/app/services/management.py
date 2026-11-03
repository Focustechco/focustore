"""Use cases for the existing SQLAlchemy catalog, separate from Prisma IDs."""
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.product import Product


class DomainError(Exception):
    def __init__(self, status: int, detail: str):
        self.status = status
        self.detail = detail


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
    return save(db, Product(**values))


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
    if model is Category and db.scalar(select(Product.id).where(Product.category_id == identifier).limit(1)):
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
