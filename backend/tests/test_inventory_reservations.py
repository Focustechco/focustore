from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models.category import Category
from app.models.product import Inventory, InventoryMovement, Product, ProductVariant, StockReservation
from app.services.inventory_reservations import InventoryReservationService, ReservationError, ReservationLine


@pytest.fixture
def reservation_db(tmp_path, isolated_settings):
    engine = create_engine(f"sqlite:///{(tmp_path / 'reservations.db').as_posix()}")

    @event.listens_for(engine, 'connect')
    def enable_foreign_keys(connection, record):
        connection.execute('PRAGMA foreign_keys = ON')

    Base.metadata.create_all(engine)
    with Session(engine) as db:
        category = Category(name='Inventory', slug='inventory', is_active=True)
        product = Product(name='Reservable', price='10.00', stock=0, category=category, slug='reservable', sku='RESERVABLE', status='ACTIVE')
        variant = ProductVariant(product=product, sku='RESERVABLE-V', name='Default', price='10.00', is_active=True)
        variant.inventory = Inventory(quantity_available=1, quantity_reserved=0)
        db.add(product)
        db.commit()
        yield engine, variant.public_id
    engine.dispose()


def test_reservation_is_atomic_and_idempotent(reservation_db):
    engine, variant_id = reservation_db
    with Session(engine) as db:
        service = InventoryReservationService(db)
        first = service.create('request-1', [ReservationLine(variant_id, 1)])
        repeated = service.create('request-1', [ReservationLine(variant_id, 1)])
        assert repeated == first
        inventory = db.scalar(select(Inventory))
        assert (inventory.quantity_available, inventory.quantity_reserved) == (0, 1)
        assert db.scalar(select(InventoryMovement).where(InventoryMovement.operation == 'reserve')) is not None


def test_idempotency_conflict_and_release_are_explicit(reservation_db):
    engine, variant_id = reservation_db
    with Session(engine) as db:
        service = InventoryReservationService(db)
        reservation = service.create('request-1', [ReservationLine(variant_id, 1)])
        with pytest.raises(ReservationError, match='different payload'):
            service.create('request-1', [ReservationLine(variant_id, 2)])
        released = service.release(reservation.reservation_id)
        assert released.status == 'released'
        assert service.release(reservation.reservation_id).status == 'released'
        inventory = db.scalar(select(Inventory))
        assert (inventory.quantity_available, inventory.quantity_reserved) == (1, 0)


def test_insufficient_inventory_rolls_back_without_audit(reservation_db):
    engine, variant_id = reservation_db
    with Session(engine) as db:
        service = InventoryReservationService(db)
        with pytest.raises(ReservationError, match='Insufficient'):
            service.create('request-1', [ReservationLine(variant_id, 2)])
        assert db.scalar(select(StockReservation)) is None
        inventory = db.scalar(select(Inventory))
        assert (inventory.quantity_available, inventory.quantity_reserved) == (1, 0)


def test_confirm_consumes_reserved_units_once(reservation_db):
    engine, variant_id = reservation_db
    with Session(engine) as db:
        service = InventoryReservationService(db)
        reservation = service.create('request-1', [ReservationLine(variant_id, 1)])
        assert service.confirm(reservation.reservation_id).status == 'confirmed'
        assert service.confirm(reservation.reservation_id).status == 'confirmed'
        inventory = db.scalar(select(Inventory))
        assert (inventory.quantity_available, inventory.quantity_reserved) == (0, 0)
