from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate, StockAdjustment
from app.security.session import Admin
from app.services import management

router = APIRouter(prefix='/products', tags=['Products'])
DbSession = Annotated[Session, Depends(get_db)]
ADMIN_RESPONSES = {
    401: {'description': 'Valid focus_session required'},
    403: {'description': 'ADMIN/MANAGER and trusted Origin required'},
    404: {'description': 'Resource not found'},
    409: {'description': 'Integrity or stock conflict'},
    503: {'description': 'Identity or persistence unavailable'},
}


@router.post('', response_model=ProductResponse, status_code=201, responses=ADMIN_RESPONSES)
def create_product(data: ProductCreate, db: DbSession, admin: Admin):
    return management.create_product(db, data.model_dump())


@router.get('', response_model=list[ProductResponse])
def list_products(
    db: DbSession, skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    category_id: Annotated[int | None, Query(gt=0)] = None,
    q: Annotated[str | None, Query(min_length=1, max_length=150)] = None,
):
    statement = select(Product)
    if category_id is not None:
        statement = statement.where(Product.category_id == category_id)
    if q is not None:
        statement = statement.where(Product.name.icontains(q, autoescape=True))
    return db.scalars(statement.order_by(Product.id).offset(skip).limit(limit)).all()


@router.get('/{product_id}', response_model=ProductResponse)
def get_product(product_id: int, db: DbSession):
    return management.required(db, Product, product_id)


@router.patch('/{product_id}', response_model=ProductResponse, responses=ADMIN_RESPONSES)
def update_product(product_id: int, data: ProductUpdate, db: DbSession, admin: Admin):
    return management.update_product(db, product_id, data.model_dump(exclude_unset=True))


@router.delete('/{product_id}', status_code=204, responses=ADMIN_RESPONSES)
def delete_product(product_id: int, db: DbSession, admin: Admin):
    management.delete_resource(db, Product, product_id)
    return Response(status_code=204)


@router.post('/{product_id}/stock-adjustments', response_model=ProductResponse, responses=ADMIN_RESPONSES)
def adjust_stock(product_id: int, data: StockAdjustment, db: DbSession, admin: Admin):
    return management.adjust_stock(db, product_id, data.delta)
