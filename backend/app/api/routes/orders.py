from typing import Annotated
from fastapi import APIRouter, Depends, Path, Query
from app.config import get_settings
from app.schemas.orders import OrderDetail, OrderPage
from app.security.session import User
from app.services.orders import OrderReader

router = APIRouter(prefix='/api/v1/orders', tags=['Own orders'])


def reader() -> OrderReader:
    return OrderReader(get_settings().legacy_catalog_sqlite_path)


Reader = Annotated[OrderReader, Depends(reader)]


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
