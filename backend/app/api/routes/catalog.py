from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import get_settings
from app.schemas.catalog import CatalogCategory, CatalogPage, CatalogProduct
from app.services.catalog_service import CatalogService


router = APIRouter(prefix='/api/v1/catalog', tags=['Catalog'])


def catalog_service() -> CatalogService:
    return CatalogService.from_path(get_settings().legacy_catalog_sqlite_path)


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
