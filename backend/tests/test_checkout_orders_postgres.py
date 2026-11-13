from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from uuid import UUID, uuid4

import pytest
from sqlalchemy import create_engine, func, select, update
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Category, Inventory, Order, OrderOutboxEvent, Product, ProductVariant, StockReservation
from app.schemas.checkout import CheckoutCreate
from app.services.checkout_orders import CheckoutOrderService
from app.services.management import DomainError
from test_integrity_agent import postgres  # noqa: F401


def seed(url: str, quantity: int = 1):
    engine = create_engine(url, hide_parameters=True)
    with Session(engine) as db:
        suffix = uuid4().hex[:10]
        product = Product(name='Checkout product', slug=f'checkout-{suffix}', sku=f'CHECKOUT-{suffix}',
                          price='20.00', stock=quantity, category=Category(name='Checkout', slug=f'checkout-{suffix}'),
                          status='ACTIVE')
        variant = ProductVariant(product=product, sku=f'CHECKOUT-V-{suffix}', name='Default', price='20.00')
        variant.inventory = Inventory(quantity_available=quantity, quantity_reserved=0)
        db.add(product)
        db.commit()
        identifier = variant.public_id
    engine.dispose()
    return identifier


def request(variant_id: UUID, key: str, quantity: int = 1) -> CheckoutCreate:
    return CheckoutCreate.model_validate({
        'items': [{'variantId': str(variant_id), 'quantity': quantity}],
        'shippingAddress': {'street': 'Rua A', 'number': '1', 'neighborhood': 'Centro',
                            'city': 'São Paulo', 'state': 'SP', 'postalCode': '01000000'},
        'shippingOption': {'carrier': 'Focus Express', 'serviceName': 'Standard SP'},
        'paymentMethod': 'PIX', 'idempotencyKey': key,
    })


def settings() -> Settings:
    return Settings(database_url='postgresql+psycopg://unused:unused@127.0.0.1/test', FOCUS_DEBUG=True,
                     catalog_source='postgresql', fastapi_checkout_enabled=True,
                     fastapi_payment_simulator_enabled=True)


def run_concurrently(url, count, operation):
    barrier = Barrier(count)

    def worker(index):
        engine = create_engine(url, hide_parameters=True, pool_size=1, max_overflow=0)
        try:
            barrier.wait(timeout=15)
            with Session(engine, expire_on_commit=False) as db:
                return operation(db, index)
        except Exception as exc:
            return exc
        finally:
            engine.dispose()

    with ThreadPoolExecutor(max_workers=count) as pool:
        return list(pool.map(worker, range(count)))


def snapshot(url, variant_id):
    engine = create_engine(url, hide_parameters=True)
    with Session(engine) as db:
        variant = db.scalar(select(ProductVariant).where(ProductVariant.public_id == variant_id))
        inventory = db.scalar(select(Inventory).where(Inventory.variant_id == variant.id))
        orders = db.scalar(select(func.count()).select_from(Order))
        reservations = db.scalar(select(func.count()).select_from(StockReservation))
        events = db.scalar(select(func.count()).select_from(OrderOutboxEvent))
        result = inventory.quantity_available, inventory.quantity_reserved, orders, reservations, events
    engine.dispose()
    return result


def test_concurrent_checkout_reserves_last_unit_once(postgres):
    _engine, url = postgres
    variant_id = seed(url)
    results = run_concurrently(url, 10, lambda db, index: CheckoutOrderService(db, settings()).create(
        f'user-{index}', request(variant_id, f'checkout-{index}')))
    successes = [result for result in results if isinstance(result, Order)]
    failures = [result for result in results if isinstance(result, DomainError)]
    assert len(successes) == 1
    assert len(failures) == 9
    assert snapshot(url, variant_id) == (0, 1, 1, 1, 1)


def test_same_checkout_key_replays_and_payload_change_conflicts(postgres):
    _engine, url = postgres
    variant_id = seed(url)
    first = request(variant_id, 'same-checkout')
    with Session(create_engine(url, hide_parameters=True)) as db:
        original = CheckoutOrderService(db, settings()).create('customer-1', first)
        original_id = original.public_id
    results = run_concurrently(url, 10, lambda db, _index: CheckoutOrderService(db, settings()).create('customer-1', first))
    assert all(isinstance(result, Order) for result in results)
    assert {result.public_id for result in results} == {original_id}
    with Session(create_engine(url, hide_parameters=True)) as db:
        with pytest.raises(DomainError, match='outro pedido'):
            CheckoutOrderService(db, settings()).create('customer-1', request(variant_id, 'same-checkout', quantity=2))
    assert snapshot(url, variant_id) == (0, 1, 1, 1, 1)


def test_payment_confirmation_and_explicit_cancel_are_idempotent(postgres):
    _engine, url = postgres
    variant_id = seed(url, quantity=2)
    engine = create_engine(url, hide_parameters=True)
    with Session(engine) as db:
        paid = CheckoutOrderService(db, settings()).create('customer-paid', request(variant_id, 'paid'))
        paid_id = paid.public_id
    with Session(engine) as db:
        assert CheckoutOrderService(db, settings()).transition_payment('customer-paid', paid_id, 'paid').status == 'paid'
    with Session(engine) as db:
        assert CheckoutOrderService(db, settings()).transition_payment('customer-paid', paid_id, 'paid').status == 'paid'
    assert snapshot(url, variant_id)[:2] == (1, 0)
    with Session(engine) as db:
        cancelled = CheckoutOrderService(db, settings()).create('customer-cancel', request(variant_id, 'cancel'))
        cancelled_id = cancelled.public_id
    with Session(engine) as db:
        assert CheckoutOrderService(db, settings()).cancel('customer-cancel', cancelled_id).status == 'cancelled'
    with Session(engine) as db:
        assert CheckoutOrderService(db, settings()).cancel('customer-cancel', cancelled_id).status == 'cancelled'
    assert snapshot(url, variant_id)[:2] == (1, 0)
    engine.dispose()


def test_order_expiration_respects_reservation_deadline(postgres):
    _engine, url = postgres
    variant_id = seed(url)
    engine = create_engine(url, hide_parameters=True)
    with Session(engine, expire_on_commit=False) as db:
        order = CheckoutOrderService(db, settings()).create('customer-expire', request(variant_id, 'expire'))
        order_id = order.public_id
        with pytest.raises(DomainError, match='deadline'):
            CheckoutOrderService(db, settings()).expire(order_id)
        reservation = db.scalar(select(StockReservation).where(StockReservation.id == order.reservation_id))
        db.execute(update(StockReservation).where(StockReservation.id == reservation.id).values(
            expires_at=datetime.now(timezone.utc) - timedelta(seconds=1)))
        db.commit()
    with Session(engine) as db:
        assert CheckoutOrderService(db, settings()).expire(order_id).status == 'expired'
    with Session(engine) as db:
        assert CheckoutOrderService(db, settings()).expire(order_id).status == 'expired'
    assert snapshot(url, variant_id)[:2] == (1, 0)
    engine.dispose()
