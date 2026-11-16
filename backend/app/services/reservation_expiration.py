"""Recoverable, manually-invoked reservation expiration processing.

This module deliberately provides no scheduler or public endpoint. Each item is
processed in its own short transaction so a worker crash leaves unprocessed
reservations pending for a later run.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
import logging

from app.models.order import Order, OrderOutboxEvent, OrderStatusHistory
from app.models.product import StockReservation
from app.services.inventory_reservations import InventoryReservationService, ReservationError


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ExpirationReport:
    processed: int = 0
    skipped: int = 0
    failed: int = 0


def _utc_now(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _candidate_ids(db: Session, now: datetime, limit: int) -> list[tuple[UUID, UUID | None]]:
    rows = db.execute(
        select(StockReservation.public_id, Order.public_id)
        .outerjoin(Order, Order.reservation_id == StockReservation.id)
        .where(StockReservation.status == 'pending', StockReservation.expires_at <= now)
        .order_by(StockReservation.expires_at, StockReservation.id)
        .limit(limit)
    ).all()
    return [(reservation_id, order_id) for reservation_id, order_id in rows]


def _expire_order(db: Session, order_id: UUID, now: datetime) -> bool:
    order = db.scalar(
        select(Order).where(Order.public_id == order_id)
        .options(selectinload(Order.payments), selectinload(Order.reservation))
        .with_for_update(skip_locked=True)
    )
    if order is None or order.status != 'pending_payment':
        return False
    # A paid or externally-unknown payment must never be released by this worker.
    if not order.payments or order.payments[0].status != 'pending':
        return False
    if order.reservation is None or order.reservation.status != 'pending':
        return False
    if (order.reservation.expires_at.replace(tzinfo=timezone.utc)
            if order.reservation.expires_at.tzinfo is None else order.reservation.expires_at) > now:
        return False
    InventoryReservationService(
        db, source='reservation-expiration', idempotency_scope=order.idempotency_scope,
    ).transition_in_transaction(order.reservation.public_id, 'expired')
    order.status = 'expired'
    order.payments[0].status = 'cancelled'
    db.add(OrderStatusHistory(order_id=order.id, status='expired', reason='Prazo da reserva atingido.'))
    db.add(OrderOutboxEvent(
        order_id=order.id, event_key=f'{order.public_id}:OrderExpired', event_type='OrderExpired',
        payload=f'{{"order_id":"{order.public_id}","status":"expired"}}'
    ))
    return True


def _expire_reservation(db: Session, reservation_id: UUID, now: datetime) -> bool:
    reservation = db.scalar(
        select(StockReservation).where(StockReservation.public_id == reservation_id)
        .options(selectinload(StockReservation.items), selectinload(StockReservation.order))
        .with_for_update(skip_locked=True)
    )
    if reservation is None or reservation.status != 'pending' or reservation.order is not None:
        return False
    expires_at = reservation.expires_at
    expires_at = expires_at if expires_at.tzinfo is not None else expires_at.replace(tzinfo=timezone.utc)
    if expires_at > now:
        return False
    InventoryReservationService(db, source='reservation-expiration').transition_in_transaction(
        reservation.public_id, 'expired'
    )
    return True


def process_expired_reservations(db: Session, *, limit: int = 100, now: datetime | None = None) -> ExpirationReport:
    """Expire at most ``limit`` due reservations, safely across workers."""
    if not 1 <= limit <= 1000:
        raise ValueError('limit must be between 1 and 1000')
    cutoff = _utc_now(now)
    with db.begin():
        candidates = _candidate_ids(db, cutoff, limit)

    processed = skipped = failed = 0
    for reservation_id, order_id in candidates:
        try:
            with db.begin():
                changed = _expire_order(db, order_id, cutoff) if order_id else _expire_reservation(db, reservation_id, cutoff)
            if changed:
                processed += 1
            else:
                skipped += 1
        except ReservationError:
            failed += 1
            logger.warning('reservation expiration rejected', extra={'reservation_id': str(reservation_id)})
        except Exception:
            failed += 1
            logger.exception('reservation expiration failed', extra={'reservation_id': str(reservation_id)})
    return ExpirationReport(processed=processed, skipped=skipped, failed=failed)
