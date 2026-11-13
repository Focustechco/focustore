from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.product import Inventory, InventoryMovement, Product, ProductVariant, StockReservation
from app.services.inventory_reservations import InventoryReservationService, ReservationError, ReservationLine

from test_integrity_agent import postgres  # noqa: F401 - shared disposable PostgreSQL fixture


def seed_variants(url: str, quantities: list[int]) -> list:
    engine = create_engine(url, hide_parameters=True)
    with Session(engine) as db:
        suffix = uuid4().hex[:12]
        category = Category(name='Concurrent', slug=f'concurrent-{suffix}')
        product = Product(
            name='Concurrent product', price=Decimal('10.00'), stock=0,
            category=category, slug=f'concurrent-{suffix}', sku=f'CONCURRENT-{suffix}', status='ACTIVE',
        )
        variants = []
        for index, quantity in enumerate(quantities):
            variant = ProductVariant(
                product=product, sku=f'CONCURRENT-{suffix}-{index}', name=f'Variant {index}',
                price=Decimal('10.00'), is_active=True,
            )
            variant.inventory = Inventory(quantity_available=quantity, quantity_reserved=0)
            variants.append(variant)
        db.add(product)
        db.commit()
        identifiers = [variant.public_id for variant in variants]
    engine.dispose()
    return identifiers


def run_concurrently(url: str, count: int, operation):
    barrier = Barrier(count)

    def worker(index: int):
        engine = create_engine(url, hide_parameters=True, pool_size=1, max_overflow=0)
        try:
            barrier.wait(timeout=15)
            with Session(engine) as db:
                return operation(db, index)
        except Exception as exc:  # assertions below classify each outcome
            return exc
        finally:
            engine.dispose()

    with ThreadPoolExecutor(max_workers=count) as pool:
        return list(pool.map(worker, range(count)))


def inventory_snapshot(url: str):
    engine = create_engine(url, hide_parameters=True)
    with Session(engine) as db:
        inventory = db.scalars(select(Inventory).order_by(Inventory.id)).all()
        movements = db.scalars(select(InventoryMovement).order_by(InventoryMovement.id)).all()
        reservations = db.scalars(select(StockReservation).order_by(StockReservation.id)).all()
        result = (
            [(row.quantity_available, row.quantity_reserved) for row in inventory],
            [(row.operation, row.quantity) for row in movements],
            [(row.status, row.idempotency_key) for row in reservations],
        )
    engine.dispose()
    return result


def test_last_unit_allows_only_one_concurrent_reservation(postgres):
    engine, url = postgres
    variant_id = seed_variants(url, [1])[0]

    results = run_concurrently(
        url, 10,
        lambda db, index: InventoryReservationService(db).create(
            f'last-unit-{index}', [ReservationLine(variant_id, 1)]
        ),
    )
    successes = [result for result in results if not isinstance(result, Exception)]
    failures = [result for result in results if isinstance(result, ReservationError)]
    assert len(successes) == 1
    assert len(failures) == 9
    available, movements, reservations = inventory_snapshot(url)
    assert available == [(0, 1)]
    assert movements == [('reserve', 1)]
    assert len(reservations) == 1


def test_same_idempotency_key_replays_one_persisted_reservation(postgres):
    engine, url = postgres
    variant_id = seed_variants(url, [1])[0]

    results = run_concurrently(
        url, 10,
        lambda db, _index: _create_and_read_same_key(db, variant_id),
    )
    assert all(not isinstance(result, Exception) for result in results), results
    assert len({result[0].reservation_id for result in results}) == 1
    assert all(result[1].reservation_id == result[0].reservation_id for result in results)
    available, movements, reservations = inventory_snapshot(url)
    assert available == [(0, 1)]
    assert movements == [('reserve', 1)]
    assert len(reservations) == 1


def _create_and_read_same_key(db, variant_id):
    service = InventoryReservationService(db)
    result = service.create('same-idempotency-key', [ReservationLine(variant_id, 1)])
    return result, service.get(result.reservation_id)


def test_same_key_with_different_payload_is_a_conflict(postgres):
    engine, url = postgres
    variant_id = seed_variants(url, [2])[0]
    setup_engine = create_engine(url, hide_parameters=True)
    with Session(setup_engine) as db:
        InventoryReservationService(db).create('payload-key', [ReservationLine(variant_id, 1)])
    setup_engine.dispose()
    # The first transaction is deliberately replayed from a new connection.
    worker_engine = create_engine(url, hide_parameters=True)
    try:
        with Session(worker_engine) as db:
            with pytest.raises(ReservationError, match='different payload'):
                InventoryReservationService(db).create('payload-key', [ReservationLine(variant_id, 2)])
    finally:
        worker_engine.dispose()


@pytest.mark.parametrize('operation_name', ['confirm', 'release'])
def test_terminal_transition_is_serialized_and_idempotent(postgres, operation_name):
    engine, url = postgres
    variant_id = seed_variants(url, [1])[0]
    setup_engine = create_engine(url, hide_parameters=True)
    with Session(setup_engine) as db:
        reservation = InventoryReservationService(db).create(
            'terminal-key', [ReservationLine(variant_id, 1)]
        )
    setup_engine.dispose()

    operation = getattr(InventoryReservationService, operation_name)
    results = run_concurrently(url, 10, lambda db, _index: operation(InventoryReservationService(db), reservation.reservation_id))
    assert all(not isinstance(result, Exception) for result in results), results
    assert {result.status for result in results} == {'confirmed' if operation_name == 'confirm' else 'released'}
    available, movements, _reservations = inventory_snapshot(url)
    expected = [('reserve', 1), (operation_name, 1)]
    assert movements == expected
    assert available == ([(1, 0)] if operation_name == 'release' else [(0, 0)])


def test_confirmation_and_expiration_have_one_winner(postgres):
    engine, url = postgres
    variant_id = seed_variants(url, [1])[0]
    setup_engine = create_engine(url, hide_parameters=True)
    with Session(setup_engine) as db:
        reservation = InventoryReservationService(db).create(
            'race-key', [ReservationLine(variant_id, 1)]
        )
    setup_engine.dispose()
    results = run_concurrently(
        url, 2,
        lambda db, index: (
            InventoryReservationService(db).confirm(reservation.reservation_id)
            if index == 0 else InventoryReservationService(db).expire(reservation.reservation_id)
        ),
    )
    assert sum(not isinstance(result, Exception) for result in results) == 1
    assert sum(isinstance(result, ReservationError) for result in results) == 1
    available, movements, reservations = inventory_snapshot(url)
    assert available in ([(0, 0)], [(1, 0)])
    assert len([movement for movement in movements if movement[0] in {'confirm', 'expire'}]) == 1
    assert reservations[0][0] in {'confirmed', 'expired'}


def test_movement_failure_rolls_back_locked_inventory(postgres):
    engine, url = postgres
    variant_id = seed_variants(url, [1])[0]
    failing_engine = create_engine(url, hide_parameters=True)

    @event.listens_for(failing_engine, 'before_cursor_execute')
    def fail_movement(_connection, _cursor, statement, _parameters, _context, _executemany):
        if 'INSERT INTO inventory_movements' in statement:
            raise RuntimeError('synthetic movement failure')

    try:
        with Session(failing_engine) as db:
            with pytest.raises(RuntimeError, match='synthetic movement failure'):
                InventoryReservationService(db).create('rollback-key', [ReservationLine(variant_id, 1)])
    finally:
        failing_engine.dispose()
    available, movements, reservations = inventory_snapshot(url)
    assert available == [(1, 0)]
    assert movements == []
    assert reservations == []


def test_multiple_variants_use_deterministic_lock_order(postgres):
    engine, url = postgres
    variants = seed_variants(url, [2, 2])
    results = run_concurrently(
        url, 2,
        lambda db, index: InventoryReservationService(db).create(
            f'multi-{index}', [ReservationLine(variants[1], 1), ReservationLine(variants[0], 1)]
        ),
    )
    assert all(not isinstance(result, Exception) for result in results), results
    available, movements, reservations = inventory_snapshot(url)
    assert available == [(0, 2), (0, 2)]
    assert len([movement for movement in movements if movement[0] == 'reserve']) == 4
    assert len(reservations) == 2


def test_reservation_survives_service_restart(postgres):
    engine, url = postgres
    variant_id = seed_variants(url, [1])[0]
    first_engine = create_engine(url, hide_parameters=True)
    with Session(first_engine) as db:
        reservation = InventoryReservationService(db).create(
            'restart-key', [ReservationLine(variant_id, 1)]
        )
    first_engine.dispose()

    second_engine = create_engine(url, hide_parameters=True)
    try:
        with Session(second_engine) as db:
            service = InventoryReservationService(db)
            assert service.get(reservation.reservation_id).status == 'pending'
            assert service.confirm(reservation.reservation_id).status == 'confirmed'
    finally:
        second_engine.dispose()
    available, movements, reservations = inventory_snapshot(url)
    assert available == [(0, 0)]
    assert movements == [('reserve', 1), ('confirm', 1)]
    assert reservations == [('confirmed', 'restart-key')]
