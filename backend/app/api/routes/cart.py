from typing import Annotated
from fastapi import APIRouter, Depends, Path, Response
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.dependencies import get_db
from app.schemas.cart import Availability, CartQuote, CartQuoteInput
from app.services.cart import CartService

router = APIRouter(tags=['Cart and availability'])


def service(db: Session = Depends(get_db)) -> CartService:
    settings = get_settings()
    return CartService(
        settings.legacy_catalog_sqlite_path,
        db=db,
        source=settings.catalog_source,
    )


Service = Annotated[CartService, Depends(service)]


@router.post('/api/v1/cart/quote', response_model=CartQuote,
             responses={404: {'description': 'Unknown/inactive variant'},
                        409: {'description': 'Insufficient stock'},
                        503: {'description': 'Catalog unavailable'}})
def quote(data: CartQuoteInput, cart: Service, response: Response):
    response.headers['Cache-Control'] = 'no-store'
    return cart.quote(data)


@router.get('/api/v1/catalog/variants/{variant_id}/availability', response_model=Availability,
            responses={404: {'description': 'Unknown/inactive variant'},
                       503: {'description': 'Catalog unavailable'}})
def availability(variant_id: Annotated[str, Path(min_length=1, max_length=255)],
                 cart: Service, response: Response):
    response.headers['Cache-Control'] = 'no-store'
    return cart.availability(variant_id)
