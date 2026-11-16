from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import create_engine, func, select, update
from sqlalchemy.orm import Session

from app.models import InventoryMovement, Order, OrderOutboxEvent, StockReservation
from app.services.checkout_orders import CheckoutOrderService
from app.services.outbox import OutboxMessage, process_pending_outbox
from app.services.reservation_expiration import process_expired_reservations
from test_checkout_orders_postgres import request, seed, settings
from test_integrity_agent import postgres  # noqa: F401


class RecordingPublisher:
    def __init__(self, fail=False):
        self.fail = fail
        self.messages: list[OutboxMessage] = []

    def publish(self, message: OutboxMessage) -> None:
        if self.fail:
            raise RuntimeError('synthetic publisher failure')
        self.messages.append(message)


def test_expiration_worker_releases_due_order_and_is_reprocessable(postgres):
    _engine, url = postgres
    variant_id = seed(url)
    engine = create_engine(url, hide_parameters=True)
    with Session(engine) as db:
        order = CheckoutOrderService(db, settings()).create('worker-customer', request(variant_id, 'worker-expire'))
        order_id = order.public_id
        db.execute(update(StockReservation).where(StockReservation.id == order.reservation_id).values(
            expires_at=datetime.now(timezone.utc) - timedelta(seconds=1)
        ))
        db.commit()

    with Session(engine) as db:
        report = process_expired_reservations(db, limit=10)
        assert report.processed == 1
    with Session(engine) as db:
        assert db.scalar(select(Order.status).where(Order.public_id == order_id)) == 'expired'
    with Session(engine) as db:
        assert process_expired_reservations(db).processed == 0
    engine.dispose()


def test_outbox_delivery_retries_failures_and_deduplicates_after_commit(postgres):
    _engine, url = postgres
    variant_id = seed(url)
    engine = create_engine(url, hide_parameters=True)
    with Session(engine) as db:
        CheckoutOrderService(db, settings()).create('outbox-customer', request(variant_id, 'outbox-key'))

    with Session(engine) as db:
        failed = process_pending_outbox(db, RecordingPublisher(fail=True))
        assert failed.failed == 1 and failed.published == 0
    publisher = RecordingPublisher()
    with Session(engine) as db:
        delivered = process_pending_outbox(db, publisher)
        assert delivered.published == 1
    with Session(engine) as db:
        assert process_pending_outbox(db, publisher).published == 0
        assert db.scalar(select(OrderOutboxEvent.published_at).limit(1)) is not None
    assert [message.event_type for message in publisher.messages] == ['OrderCreated']
    engine.dispose()


def test_concurrent_expiration_workers_have_one_winner(postgres):
    _engine, url = postgres
    variant_id = seed(url)
    engine = create_engine(url, hide_parameters=True)
    with Session(engine) as db:
        order = CheckoutOrderService(db, settings()).create('race-customer', request(variant_id, 'race-expire'))
        db.execute(update(StockReservation).where(StockReservation.id == order.reservation_id).values(
            expires_at=datetime.now(timezone.utc) - timedelta(seconds=1)
        ))
        db.commit()

    def run_worker():
        worker_engine = create_engine(url, hide_parameters=True, pool_size=1, max_overflow=0)
        try:
            with Session(worker_engine) as db:
                return process_expired_reservations(db, limit=1)
        finally:
            worker_engine.dispose()

    with ThreadPoolExecutor(max_workers=2) as workers:
        reports = list(workers.map(lambda _: run_worker(), range(2)))
    with Session(engine) as db:
        assert sum(report.processed for report in reports) == 1
        assert db.scalar(select(func.count()).select_from(InventoryMovement).where(
            InventoryMovement.operation == 'expire')) == 1
    engine.dispose()
