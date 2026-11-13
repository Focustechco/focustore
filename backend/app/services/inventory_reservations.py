"""Transactional PostgreSQL inventory reservations.

This module is intentionally internal. Prisma remains the owner of the live
checkout flow until an explicit cross-system transaction is introduced.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import json
from typing import Iterable
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.product import Inventory, InventoryMovement, ProductVariant, StockReservation, StockReservationItem


class ReservationError(Exception):
    """Expected domain failure while changing reservation state."""


@dataclass(frozen=True)
class ReservationLine:
    variant_public_id: UUID
    quantity: int


@dataclass(frozen=True)
class ReservationResult:
    reservation_id: UUID
    status: str
    expires_at: datetime


class InventoryReservationService:
    def __init__(self, db: Session, *, source: str = 'internal-inventory', idempotency_scope: str = 'default') -> None:
        self.db = db
        self.source = source
        self.idempotency_scope = idempotency_scope

    @staticmethod
    def _canonical_lines(lines: Iterable[ReservationLine]) -> list[ReservationLine]:
        result = list(lines)
        if not result or any(line.quantity <= 0 for line in result):
            raise ReservationError('Reservation quantities must be positive.')
        if len({line.variant_public_id for line in result}) != len(result):
            raise ReservationError('A variant may occur only once in a reservation.')
        return sorted(result, key=lambda line: str(line.variant_public_id))

    def _request_hash(self, lines: list[ReservationLine], ttl_seconds: int) -> str:
        payload = {'lines': [(str(line.variant_public_id), line.quantity) for line in lines], 'ttl_seconds': ttl_seconds}
        return hashlib.sha256(json.dumps(payload, separators=(',', ':'), sort_keys=True).encode()).hexdigest()

    @staticmethod
    def _result(reservation: StockReservation) -> ReservationResult:
        expires_at = reservation.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        return ReservationResult(reservation.public_id, reservation.status, expires_at)

    def create(self, idempotency_key: str, lines: Iterable[ReservationLine], *, ttl_seconds: int = 900) -> ReservationResult:
        """Create or replay a reservation, including concurrent same-key callers."""
        lines = list(lines)
        for attempt in range(2):
            try:
                return self._create_once(idempotency_key, lines, ttl_seconds=ttl_seconds)
            except IntegrityError:
                self.db.rollback()
                existing = self.db.scalar(
                    select(StockReservation).where(
                        StockReservation.idempotency_scope == self.idempotency_scope,
                        StockReservation.idempotency_key == idempotency_key,
                    )
                )
                if existing is not None:
                    canonical = self._canonical_lines(lines)
                    if existing.request_hash != self._request_hash(canonical, ttl_seconds):
                        raise ReservationError('Idempotency key was already used with a different payload.')
                    return self._result(existing)
                if attempt == 0:
                    continue
                raise ReservationError('Reservation could not be committed safely.')
        raise ReservationError('Reservation could not be committed safely.')

    def _create_once(self, idempotency_key: str, lines: Iterable[ReservationLine], *, ttl_seconds: int = 900) -> ReservationResult:
        if not idempotency_key.strip() or len(idempotency_key) > 200:
            raise ReservationError('A valid idempotency key is required.')
        if not 1 <= ttl_seconds <= 86400:
            raise ReservationError('Reservation TTL must be between 1 and 86400 seconds.')
        canonical = self._canonical_lines(lines)
        request_hash = self._request_hash(canonical, ttl_seconds)

        with self.db.begin():
            existing = self.db.scalar(
                select(StockReservation).where(
                    StockReservation.idempotency_scope == self.idempotency_scope,
                    StockReservation.idempotency_key == idempotency_key,
                ).options(selectinload(StockReservation.items))
            )
            if existing is not None:
                if existing.request_hash != request_hash:
                    raise ReservationError('Idempotency key was already used with a different payload.')
                return self._result(existing)

            variant_ids = [line.variant_public_id for line in canonical]
            variants = self.db.scalars(
                select(ProductVariant).where(ProductVariant.public_id.in_(variant_ids)).order_by(ProductVariant.id)
            ).all()
            by_public_id = {variant.public_id: variant for variant in variants}
            if len(by_public_id) != len(canonical) or any(not variant.is_active or variant.product.status != 'ACTIVE' for variant in variants):
                raise ReservationError('One or more variants do not exist or are inactive.')

            inventory_by_variant: dict[int, Inventory] = {}
            for variant in variants:
                inventory = self.db.scalar(
                    select(Inventory).where(Inventory.variant_id == variant.id).with_for_update()
                )
                if inventory is None:
                    raise ReservationError(f'No inventory exists for variant {variant.public_id}.')
                inventory_by_variant[variant.id] = inventory

            reservation = StockReservation(
                idempotency_scope=self.idempotency_scope,
                idempotency_key=idempotency_key,
                request_hash=request_hash,
                expires_at=datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds),
            )
            self.db.add(reservation)
            self.db.flush()
            for line in canonical:
                variant = by_public_id[line.variant_public_id]
                inventory = inventory_by_variant[variant.id]
                if inventory.quantity_available < line.quantity:
                    raise ReservationError(f'Insufficient inventory for variant {line.variant_public_id}.')
                inventory.quantity_available -= line.quantity
                inventory.quantity_reserved += line.quantity
                item = StockReservationItem(reservation_id=reservation.id, variant_id=variant.id, quantity=line.quantity)
                self.db.add(item)
                self.db.add(InventoryMovement(
                    inventory_id=inventory.id, reservation_id=reservation.id, variant_id=variant.id,
                    operation='reserve', quantity=line.quantity, source=self.source,
                    transaction_reference=idempotency_key,
                ))
            self.db.flush()
            return self._result(reservation)

    def get(self, reservation_id: UUID) -> ReservationResult | None:
        reservation = self.db.scalar(select(StockReservation).where(StockReservation.public_id == reservation_id))
        return None if reservation is None else self._result(reservation)

    def _transition(self, reservation_id: UUID, target: str) -> ReservationResult:
        with self.db.begin():
            reservation = self.db.scalar(
                select(StockReservation).where(StockReservation.public_id == reservation_id)
                .options(selectinload(StockReservation.items)).with_for_update()
            )
            if reservation is None:
                raise ReservationError('Reservation not found.')
            if reservation.status == target:
                return self._result(reservation)
            if reservation.status != 'pending' or target not in {'confirmed', 'released', 'expired'}:
                raise ReservationError(f'Invalid reservation transition: {reservation.status} -> {target}.')

            for item in sorted(reservation.items, key=lambda item: item.variant_id):
                inventory = self.db.scalar(select(Inventory).where(Inventory.variant_id == item.variant_id).with_for_update())
                if inventory is None or inventory.quantity_reserved < item.quantity:
                    raise ReservationError('Reserved inventory invariant was violated.')
                inventory.quantity_reserved -= item.quantity
                if target != 'confirmed':
                    inventory.quantity_available += item.quantity
                self.db.add(InventoryMovement(
                    inventory_id=inventory.id, reservation_id=reservation.id, variant_id=item.variant_id,
                    operation={'confirmed': 'confirm', 'released': 'release', 'expired': 'expire'}[target],
                    quantity=item.quantity,
                    source=self.source, transaction_reference=str(reservation.public_id),
                ))
            reservation.status = target
            self.db.flush()
            return self._result(reservation)

    def confirm(self, reservation_id: UUID) -> ReservationResult:
        return self._transition(reservation_id, 'confirmed')

    def release(self, reservation_id: UUID) -> ReservationResult:
        return self._transition(reservation_id, 'released')

    def expire(self, reservation_id: UUID) -> ReservationResult:
        return self._transition(reservation_id, 'expired')
