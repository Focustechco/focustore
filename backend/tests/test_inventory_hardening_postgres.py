from uuid import uuid4
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from threading import Event
import time

import pytest
from sqlalchemy import create_engine, event, inspect, select, text
from sqlalchemy.engine import Engine
from alembic import command
from alembic.config import Config
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.models import Inventory, StockReservation
from app.services.inventory_reservations import InventoryReservationService as Service, ReservationError, ReservationLine
from test_integrity_agent import postgres  # noqa: F401
from test_inventory_reservations_postgres import seed_variants, inventory_snapshot


@pytest.mark.parametrize('quantity', [True, 0.5, -1, 0, 2147483648])
def test_quantities_are_strict_bounded_integers(postgres, quantity):
    engine, url = postgres
    variant = seed_variants(url, [1])[0]
    with Session(engine) as db, pytest.raises(ReservationError):
        Service(db).create('invalid-quantity', [ReservationLine(variant, quantity)])
    assert inventory_snapshot(url) == ([(1, 0)], [], [])


@pytest.mark.parametrize('ttl', [True, 0.5, 0, 86401])
def test_ttl_is_strict_bounded_integer(postgres, ttl):
    engine, url = postgres
    variant = seed_variants(url, [1])[0]
    with Session(engine) as db, pytest.raises(ReservationError):
        Service(db).create('invalid-ttl', [ReservationLine(variant, 1)], ttl_seconds=ttl)
    assert inventory_snapshot(url) == ([(1, 0)], [], [])


def test_cached_inventory_cannot_reserve_a_unit_already_taken(postgres):
    engine, url = postgres
    variant = seed_variants(url, [1])[0]
    with Session(engine) as cached_db:
        with pytest.raises(ReservationError, match='Insufficient'):
            with cached_db.begin():
                cached = cached_db.scalar(select(Inventory))
                assert cached.quantity_available == 1
                with Session(engine) as other:
                    Service(other).create('winner', [ReservationLine(variant, 1)])
                Service(cached_db).create_in_transaction('loser', [ReservationLine(variant, 1)])
    assert inventory_snapshot(url)[0] == [(0, 1)]


def test_cached_reservation_observes_external_release(postgres):
    engine, url = postgres
    variant = seed_variants(url, [1])[0]
    with Session(engine) as db:
        result = Service(db).create('cached-release', [ReservationLine(variant, 1)])
    with Session(engine) as cached_db, cached_db.begin():
        cached = cached_db.scalar(select(StockReservation))
        assert cached.status == 'pending'
        with Session(engine) as other:
            Service(other).release(result.reservation_id)
        assert Service(cached_db).transition_in_transaction(result.reservation_id, 'released').status == 'released'
    assert inventory_snapshot(url)[0] == [(1, 0)]


def test_inventory_cannot_be_reassigned_to_another_variant(postgres):
    engine, url = postgres
    seed_variants(url, [1, 1])
    with pytest.raises(DBAPIError, match='inventory identity'):
        with engine.begin() as connection:
            connection.execute(text('UPDATE inventory SET variant_id=2 WHERE variant_id=1'))


def test_inventory_history_rejects_truncate_and_invalid_state(postgres):
    engine, url = postgres
    variant = seed_variants(url, [1])[0]
    with Session(engine) as db:
        Service(db).create('history', [ReservationLine(variant, 1)])
    for sql in ('TRUNCATE inventory_movements', 'TRUNCATE stock_reservations CASCADE',
                "UPDATE stock_reservations SET status='confirmed'", 'DELETE FROM stock_reservation_items'):
        with pytest.raises(DBAPIError):
            with engine.begin() as connection:
                connection.execute(text(sql))
    assert inventory_snapshot(url)[0] == [(0, 1)]


def test_reserved_counter_and_baseline_are_database_invariants(postgres):
    engine, url = postgres
    seed_variants(url, [1])
    for sql in ('UPDATE inventory SET quantity_reserved=10',
                'UPDATE inventory SET unattributed_reserved=10'):
        with pytest.raises(DBAPIError):
            with engine.begin() as connection:
                connection.execute(text(sql))
    assert inventory_snapshot(url)[0] == [(1, 0)]


def test_database_retry_rolls_back_before_repeating_reservation(postgres):
    engine, url = postgres
    variant = seed_variants(url, [1])[0]
    fired = []

    def fail_once(connection, cursor, statement, parameters, context, executemany):
        if 'INSERT INTO inventory_movements' in statement and not fired:
            fired.append(True)
            connection.exec_driver_sql("DO $$ BEGIN RAISE EXCEPTION 'synthetic contention' USING ERRCODE='40P01'; END $$")

    event.listen(engine, 'before_cursor_execute', fail_once)
    try:
        with Session(engine) as db:
            assert Service(db).create('retry', [ReservationLine(variant, 1)]).status == 'pending'
    finally:
        event.remove(engine, 'before_cursor_execute', fail_once)
    assert fired
    assert inventory_snapshot(url) == ([(0, 1)], [('reserve', 1)], [('pending', 'retry')])


def test_populated_upgrade_rolls_back_on_failure_and_preserves_legacy_balances(postgres):
    engine, _ = postgres
    config = Config(str(Path(__file__).resolve().parents[1] / 'alembic.ini'))
    command.downgrade(config, 'f6b7c8d9e0f1')
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO categories (id,name,slug) VALUES (1,'Legacy','legacy')"))
        connection.execute(text("INSERT INTO products (id,public_id,name,price,stock,category_id) VALUES (1,:id,'Legacy',10,9,1)"), {'id': uuid4()})
        connection.execute(text("INSERT INTO product_variants (id,public_id,product_id,sku,name,price) VALUES (1,:id,1,'Legacy','Legacy',10)"), {'id': uuid4()})
        connection.execute(text('INSERT INTO inventory (variant_id,quantity_available,quantity_reserved) VALUES (1,4,2)'))

    def fail_ddl(connection, cursor, statement, parameters, context, executemany):
        if 'CREATE FUNCTION inventory_ledger_consistency' in statement:
            raise RuntimeError('synthetic migration failure')

    event.listen(Engine, 'before_cursor_execute', fail_ddl)
    try:
        with pytest.raises(RuntimeError, match='synthetic migration failure'):
            command.upgrade(config, 'head')
    finally:
        event.remove(Engine, 'before_cursor_execute', fail_ddl)
    assert 'unattributed_reserved' not in {c['name'] for c in inspect(engine).get_columns('inventory')}
    command.upgrade(config, 'head')
    command.upgrade(config, 'head')
    with engine.connect() as connection:
        assert connection.execute(text('SELECT quantity_available,quantity_reserved,unattributed_reserved FROM inventory')).one() == (4, 2, 2)
        assert connection.execute(text('SELECT stock FROM products')).scalar_one() == 9


def test_confirmation_rechecks_deadline_after_waiting_for_inventory_lock(postgres):
    engine, url = postgres
    variant = seed_variants(url, [1])[0]
    with Session(engine) as db:
        result = Service(db).create('lock-deadline', [ReservationLine(variant, 1)])
    with engine.begin() as connection:
        connection.execute(text("UPDATE stock_reservations SET expires_at=clock_timestamp()+interval '1 second'"))
    worker_engine = create_engine(url)
    waiting = Event()

    @event.listens_for(worker_engine, 'before_cursor_execute')
    def signal_inventory_wait(connection, cursor, statement, parameters, context, executemany):
        if 'FROM inventory' in statement and 'FOR UPDATE' in statement:
            waiting.set()

    def confirm():
        with Session(worker_engine) as db:
            with pytest.raises(ReservationError, match='expired'):
                Service(db).confirm(result.reservation_id)

    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            with engine.begin() as holder:
                holder.execute(text('SELECT id FROM inventory FOR UPDATE'))
                task = pool.submit(confirm)
                assert waiting.wait(timeout=10)
                time.sleep(1.1)
            task.result(timeout=15)
        with Session(engine) as db:
            Service(db).expire(result.reservation_id)
        assert inventory_snapshot(url)[0] == [(1, 0)]
    finally:
        worker_engine.dispose()
