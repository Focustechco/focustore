from typing import Annotated, Any
from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.dependencies import get_db
from app.schemas.orders import OrderCreateInput, OrderDetail, OrderPage
from app.security.session import User, require_trusted_origin
from app.services.orders import OrderReader
from app.services.postgres_orders import PostgresOrderService

router = APIRouter(prefix='/api/v1/orders', tags=['Own orders'])


def reader(db: Session = Depends(get_db)) -> Any:
    settings = get_settings()
    if settings.catalog_source == 'postgresql':
        return PostgresOrderService(db)
    return OrderReader(settings.legacy_catalog_sqlite_path)


Reader = Annotated[Any, Depends(reader)]


def postgres_service(db: Session = Depends(get_db)) -> PostgresOrderService:
    return PostgresOrderService(db)


PostgresService = Annotated[PostgresOrderService, Depends(postgres_service)]
TrustedOrigin = Annotated[None, Depends(require_trusted_origin)]


@router.post('', response_model=OrderDetail, status_code=201,
             responses={401: {'description': 'Session required'}, 409: {'description': 'Conflict'},
                        422: {'description': 'Invalid order'}, 503: {'description': 'Source unavailable'}})
def create_order(data: OrderCreateInput, user: User, source: PostgresService, _origin: TrustedOrigin):
    if get_settings().catalog_source != 'postgresql':
        from app.services.catalog_service import CatalogUnavailable
        raise CatalogUnavailable
    return source.create(user.id, data)


@router.get('', response_model=OrderPage,
            responses={401: {'description': 'Session required'}, 503: {'description': 'Source unavailable'}})
def list_orders(user: User, source: Reader, offset: Annotated[int, Query(ge=0)] = 0,
                limit: Annotated[int, Query(ge=1, le=100)] = 20):
    return source.list(user.id, offset, limit)


@router.get('/{order_id}', response_model=OrderDetail,
            responses={401: {'description': 'Session required'}, 404: {'description': 'Own order not found'},
                       503: {'description': 'Source unavailable'}})
def get_order(order_id: Annotated[str, Path(min_length=1, max_length=255)], user: User, source: Reader):
    return source.detail(user.id, order_id)
