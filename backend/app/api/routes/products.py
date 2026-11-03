
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.dependencies import get_db
from app.models.category import Category
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductResponse


router = APIRouter(prefix="/products", tags=["Products"])

DbSession = Annotated[Session, Depends(get_db)]


@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_product(data: ProductCreate, db: DbSession):
    category = db.get(Category, data.category_id)

    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoria não encontrada.",
        )

    product = Product(**data.model_dump())

    db.add(product)
    db.commit()
    db.refresh(product)

    return product

    
@router.get(
    "",
    response_model=list[ProductResponse],
    status_code=status.HTTP_200_OK,
)
def list_products(
    db: DbSession,
    skip: int = 0,
    limit: int = 20,
):
    from sqlalchemy import select

    if skip < 0 or limit < 1 or limit > 100:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Parâmetros de paginação inválidos.",
        )

    statement = (
        select(Product)
        .order_by(Product.id)
        .offset(skip)
        .limit(limit)
    )

    return db.scalars(statement).all()


@router.get(
    "/{product_id}",
    response_model=ProductResponse,
    status_code=status.HTTP_200_OK,
)
def get_product(product_id: int, db: DbSession):
    product = db.get(Product, product_id)

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado.",
        )

    return product
