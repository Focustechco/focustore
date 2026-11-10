from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.dependencies import get_db
from app.schemas.catalog import CatalogCategory, CatalogPage, CatalogProduct
from app.services.catalog_service import CatalogService


router = APIRouter(prefix='/api/v1/catalog', tags=['Catalog'])


def catalog_service(db: Session = Depends(get_db)) -> CatalogService:
    return CatalogService.from_settings(get_settings(), db)


Service = Annotated[CatalogService, Depends(catalog_service)]
Offset = Annotated[int, Query(ge=0)]
Limit = Annotated[int, Query(ge=1, le=100)]


@router.get('/products', response_model=CatalogPage[CatalogProduct],
            responses={503: {'description': 'Catalog source unavailable'}})
def list_catalog_products(
    service: Service, offset: Offset = 0, limit: Limit = 20
) -> CatalogPage[CatalogProduct]:
    return service.products(offset, limit)


@router.get('/products/{slug}', response_model=CatalogProduct,
            responses={404: {'description': 'Product not found'},
                       503: {'description': 'Catalog source unavailable'}})
def get_catalog_product(slug: str, service: Service) -> CatalogProduct:
    product = service.product(slug)
    if product is None:
        raise HTTPException(status_code=404, detail='Produto não encontrado.')
    return product


@router.get('/categories', response_model=CatalogPage[CatalogCategory],
            responses={503: {'description': 'Catalog source unavailable'}})
def list_catalog_categories(
    service: Service, offset: Offset = 0, limit: Limit = 20
) -> CatalogPage[CatalogCategory]:
    return service.categories(offset, limit)


@router.get('/categories/{slug}', response_model=CatalogCategory,
            responses={404: {'description': 'Category not found'},
                       503: {'description': 'Catalog source unavailable'}})
def get_catalog_category(slug: str, service: Service) -> CatalogCategory:
    category = service.category(slug)
    if category is None:
        raise HTTPException(status_code=404, detail='Categoria nao encontrada.')
    return category
