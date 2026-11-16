"""Transactional outbox delivery with explicit at-least-once semantics."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.order import OrderOutboxEvent


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class OutboxMessage:
    event_key: str
    event_type: str
    payload: str


class OutboxPublisher(Protocol):
    def publish(self, message: OutboxMessage) -> None: ...


@dataclass(frozen=True)
class OutboxReport:
    published: int = 0
    skipped: int = 0
    failed: int = 0


def process_pending_outbox(db: Session, publisher: OutboxPublisher, *, limit: int = 100) -> OutboxReport:
    """Publish a bounded batch using row locks and retry-safe transactions.

    The publisher may receive a duplicate if the process crashes after the
    external publish and before the database commit. Consumers must therefore
    deduplicate by ``event_key``; exactly-once delivery is not claimed.
    """
    if not 1 <= limit <= 1000:
        raise ValueError('limit must be between 1 and 1000')
    with db.begin():
        ids = list(db.scalars(
            select(OrderOutboxEvent.id).where(OrderOutboxEvent.published_at.is_(None))
            .order_by(OrderOutboxEvent.created_at, OrderOutboxEvent.id).limit(limit)
        ))

    published = skipped = failed = 0
    for event_id in ids:
        try:
            with db.begin():
                event = db.scalar(
                    select(OrderOutboxEvent).where(OrderOutboxEvent.id == event_id)
                    .with_for_update(skip_locked=True)
                )
                if event is None or event.published_at is not None:
                    skipped += 1
                    continue
                publisher.publish(OutboxMessage(event.event_key, event.event_type, event.payload))
                event.published_at = datetime.now(timezone.utc)
                published += 1
        except Exception:
            failed += 1
            logger.exception('outbox delivery failed', extra={'event_id': event_id})
    return OutboxReport(published=published, skipped=skipped, failed=failed)
