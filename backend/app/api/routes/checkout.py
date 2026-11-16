from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.dependencies import get_db
from app.schemas.checkout import CheckoutCreate, OrderPage, OrderResponse, PaymentSimulationInput
from app.security.session import User
from app.services.checkout_orders import CheckoutOrderService


router = APIRouter(prefix='/api/v1/checkout', tags=['FastAPI checkout (opt-in)'])
DbSession = Annotated[Session, Depends(get_db)]


def service(db: DbSession) -> CheckoutOrderService:
    return CheckoutOrderService(db, get_settings())


Service = Annotated[CheckoutOrderService, Depends(service)]


@router.post('/orders', response_model=OrderResponse, status_code=201,
             responses={401: {'description': 'Session required'}, 404: {'description': 'Checkout disabled'},
                        409: {'description': 'Stock or idempotency conflict'}, 503: {'description': 'Provider unavailable'}})
def create_order(data: CheckoutCreate, user: User, checkout: Service):
    return checkout.create(user.id, data)


@router.get('/orders', response_model=OrderPage,
            responses={401: {'description': 'Session required'}, 404: {'description': 'Checkout disabled'}})
def list_checkout_orders(user: User, checkout: Service,
                         offset: Annotated[int, Query(ge=0)] = 0,
                         limit: Annotated[int, Query(ge=1, le=100)] = 20):
    items, total = checkout.list(user.id, offset, limit)
    return OrderPage(items=items, total=total, offset=offset, limit=limit)


@router.get('/orders/{order_id}', response_model=OrderResponse,
            responses={401: {'description': 'Session required'}, 404: {'description': 'Own order not found'}})
def get_checkout_order(order_id: UUID, user: User, checkout: Service):
    return checkout.get(user.id, order_id)


@router.post('/orders/{order_id}/cancel', response_model=OrderResponse,
             responses={401: {'description': 'Session required'}, 404: {'description': 'Own order not found'},
                        409: {'description': 'Invalid order state'}})
def cancel_checkout_order(order_id: UUID, user: User, checkout: Service):
    return checkout.cancel(user.id, order_id)


@router.post('/orders/{order_id}/payment-simulation', response_model=OrderResponse,
             responses={401: {'description': 'Session required'}, 404: {'description': 'Simulator unavailable'},
                        409: {'description': 'Invalid order state'}})
def simulate_payment(order_id: UUID, data: PaymentSimulationInput, user: User, checkout: Service):
    return checkout.transition_payment(user.id, order_id, data.status)
