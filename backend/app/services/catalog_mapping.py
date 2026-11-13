"""Internal PostgreSQL unit of work. Caller owns commit/rollback, including conflicts.

No HTTP routes, checkout hooks, writes to Prisma, or stock authorization.
"""
from dataclasses import dataclass
import sqlite3
from typing import Protocol
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import CatalogMappingEvent, CatalogVariantMapping as Mapping, Inventory, Product, ProductVariant
from app.services.catalog_mapping_policy import Assessment, VariantSnapshot, assess, catalog_diagnostics, money, normalize


class Source(Protocol):
    namespace: str

    def snapshot(self, identifier: UUID) -> VariantSnapshot | None: ...


def uuid_id(value: UUID | str) -> UUID:
    if not isinstance(value, (UUID, str)):
        raise ValueError('A real UUID is required; integer IDs are not accepted')
    return UUID(str(value))


def context(source: str, reason: str, actor: str | None):
    if not source.strip() or len(source) > 120 or not reason.strip():
        raise ValueError('Operation source and reason are required')
    if actor is not None and (not actor.strip() or len(actor) > 120):
        raise ValueError('Actor must be an actual supplied identity or None')


@dataclass(frozen=True)
class Result:
    status: str
    mapping_id: int | None = None
    state: str | None = None
    prisma_variant_id: UUID | None = None
    postgres_variant_public_id: UUID | None = None
    detail: str | None = None
    assessment: Assessment | None = None


class CatalogMappingService:
    def __init__(self, db: Session, prisma: Source):
        if db.get_bind().dialect.name != 'postgresql':
            raise ValueError('Mapping requires migrated PostgreSQL')
        if not prisma.namespace.strip() or len(prisma.namespace) > 80:
            raise ValueError('A stable Prisma namespace is required')
        self.db, self.prisma = db, prisma

    def _pg_snapshot(self, identifier: UUID) -> VariantSnapshot | None:
        row = self.db.execute(select(ProductVariant, Product, Inventory).join(
            Product, Product.id == ProductVariant.product_id
        ).outerjoin(Inventory, Inventory.variant_id == ProductVariant.id).where(
            ProductVariant.public_id == identifier).execution_options(populate_existing=True)).first()
        if row is None:
            return None
        variant, product, inventory = row
        count = sum(normalize(sku) == normalize(variant.sku)
                    for sku in self.db.scalars(select(ProductVariant.sku)))
        return VariantSnapshot(
            variant_id=str(variant.public_id), parent_id=str(product.public_id),
            sku=variant.sku, parent_sku=product.sku,
            attributes={key: getattr(variant, key) for key in ('color', 'color_hex', 'size', 'model')},
            active=variant.is_active, parent_active=product.status == 'ACTIVE',
            price=money(variant.price), promotional_price=money(variant.promotional_price),
            available=inventory.quantity_available if inventory else None,
            reserved=inventory.quantity_reserved if inventory else None, normalized_sku_count=count,
        )

    def postgres_diagnostics(self) -> dict:
        return catalog_diagnostics(
            [dict(row) for row in self.db.execute(select(Product.id, Product.status)).mappings()],
            [dict(row) for row in self.db.execute(select(
                ProductVariant.id, ProductVariant.product_id, ProductVariant.sku, ProductVariant.is_active)).mappings()],
        )

    def audit_links(self, *, after_id: int = 0, limit: int = 100) -> list[Result]:
        """Read-only, bounded scan including terminal history and external orphans."""
        if not 1 <= limit <= 1000:
            raise ValueError('Audit page size must be between 1 and 1000')
        rows = self.db.scalars(select(Mapping).where(
            Mapping.prisma_source == self.prisma.namespace, Mapping.id > after_id
        ).order_by(Mapping.id).limit(limit).execution_options(populate_existing=True)).all()
        results = []
        for row in rows:
            try:
                _, assessment = self._evidence(row.prisma_variant_id, row.postgres_variant_public_id)
            except (sqlite3.Error, OSError):
                results.append(self._result(row, 'inconsistent', 'source_unavailable'))
                continue
            if assessment.classification == 'absent':
                results.append(self._result(row, 'inconsistent', 'missing_variant_or_parent', assessment))
            else:
                results.append(self._resolve(row))
        return results

    def _evidence(self, prisma_id: UUID, pg_id: UUID) -> tuple[dict, Assessment]:
        left, right = self.prisma.snapshot(prisma_id), self._pg_snapshot(pg_id)
        return {'prisma': left.document() if left else None, 'postgres': right.document() if right else None}, assess(left, right)

    def _result(self, row: Mapping, status: str, detail=None, assessment=None) -> Result:
        # Non-verified responses never expose a resolved identity pair.
        return Result(status, row.id, row.state,
                      row.prisma_variant_id if status == 'verified' else None,
                      row.postgres_variant_public_id if status == 'verified' else None, detail, assessment)

    def _lookup(self, predicate) -> Mapping | None:
        return self.db.scalar(select(Mapping).where(
            Mapping.prisma_source == self.prisma.namespace, predicate
        ).order_by(Mapping.state.in_(['candidate', 'verified']).desc(), Mapping.id.desc()).limit(1)
            .execution_options(populate_existing=True))

    def state(self, mapping_id: int) -> Result:
        row = self._lookup(Mapping.id == mapping_id)
        return Result(row.state, row.id, row.state) if row else Result('not_found')

    def by_prisma(self, identifier: UUID | str) -> Result:
        return self._resolve(self._lookup(Mapping.prisma_variant_id == uuid_id(identifier)))

    def by_postgres(self, identifier: UUID | str) -> Result:
        return self._resolve(self._lookup(Mapping.postgres_variant_public_id == uuid_id(identifier)))

    def _resolve(self, row: Mapping | None) -> Result:
        if row is None:
            return Result('not_found')
        if row.state != 'verified':
            return self._result(row, 'pending' if row.state == 'candidate' else row.state)
        try:
            evidence, assessment = self._evidence(row.prisma_variant_id, row.postgres_variant_public_id)
        except (sqlite3.Error, OSError):
            return self._result(row, 'inconsistent', 'source_unavailable')
        if assessment.classification != 'verifiable':
            return self._result(row, 'inconsistent', 'source_missing_or_divergent', assessment)
        if any(evidence[key]['identity_hash'] != row.evidence.get(key, {}).get('identity_hash')
               for key in ('prisma', 'postgres')):
            return self._result(row, 'inconsistent', 'identity_drift', assessment)
        return self._result(row, 'verified', assessment=assessment)

    def _conflict(self, row: Mapping, operation_source, reason, actor, details) -> Result:
        self.db.add(CatalogMappingEvent(
            mapping_id=row.id, event_type='MappingConflictDetected', previous_state=row.state,
            next_state=row.state, operation_source=operation_source, reason=reason, actor=actor, evidence=details,
        ))
        self.db.flush()
        return self._result(row, 'conflict', reason)

    def candidate(self, prisma_id: UUID | str, pg_id: UUID | str, *, source: str, reason: str,
                  actor: str | None = None) -> Result:
        context(source, reason, actor)
        prisma_id, pg_id = uuid_id(prisma_id), uuid_id(pg_id)
        try:
            evidence, assessment = self._evidence(prisma_id, pg_id)
        except (sqlite3.Error, OSError):
            return Result('inconsistent', detail='source_unavailable')
        if assessment.classification == 'absent':
            return Result('inconsistent', detail='missing_variant_or_parent', assessment=assessment)
        row = Mapping(prisma_source=self.prisma.namespace, prisma_variant_id=prisma_id,
                      postgres_variant_public_id=pg_id, source=source, operation_source=source,
                      reason=reason, actor=actor, evidence=evidence)
        try:
            with self.db.begin_nested():
                self.db.add(row)
                self.db.flush()
        except IntegrityError as exc:
            if exc.orig.sqlstate == '23503':
                return Result('inconsistent', detail='postgres_variant_removed')
            if exc.orig.sqlstate != '23505':
                raise
            if exc.orig.diag.constraint_name not in {'uq_mapping_active_prisma', 'uq_mapping_active_postgres'}:
                return Result('inconsistent', detail='mapping_identifier_collision')
            existing = self.db.scalar(select(Mapping).where(
                or_(
                    (Mapping.prisma_source == self.prisma.namespace) & (Mapping.prisma_variant_id == prisma_id),
                    Mapping.postgres_variant_public_id == pg_id,
                )).order_by(Mapping.state.in_(['candidate', 'verified']).desc(), Mapping.id.desc())
                .with_for_update().limit(1).execution_options(populate_existing=True))
            if existing is None:
                return Result('inconsistent', detail='conflicting_history_missing')
            return self._conflict(existing, source, reason, actor,
                                  {'attempted_prisma_id': str(prisma_id), 'attempted_postgres_id': str(pg_id),
                                   'attempted_source': self.prisma.namespace})
        return self._result(row, 'pending', assessment=assessment)

    def transition(self, mapping_id: int, target: str, *, source: str, reason: str,
                   actor: str | None = None, review: dict | None = None) -> Result:
        context(source, reason, actor)
        row = self.db.scalar(select(Mapping).where(
            Mapping.id == mapping_id, Mapping.prisma_source == self.prisma.namespace
        ).with_for_update().execution_options(populate_existing=True))
        if row is None:
            return Result('not_found')
        if (row.state, target) not in {('candidate', 'verified'), ('candidate', 'rejected'), ('verified', 'revoked')}:
            return self._conflict(row, source, 'invalid_transition: ' + reason, actor, {'requested_state': target})
        if target == 'verified':
            if (not review or any(review.get(key) is not True for key in ('confirmed', 'parent_checked', 'attributes_checked'))
                    or not isinstance(review.get('reference'), str) or not review['reference'].strip()):
                return self._conflict(row, source, 'insufficient_evidence: ' + reason, actor, {})
            try:
                evidence, assessment = self._evidence(row.prisma_variant_id, row.postgres_variant_public_id)
            except (sqlite3.Error, OSError):
                return self._conflict(row, source, 'source_unavailable: ' + reason, actor, {})
            if assessment.classification != 'verifiable':
                return self._conflict(row, source, 'inconsistent_evidence: ' + reason, actor,
                                      {'classification': assessment.classification, 'issues': list(assessment.issues)})
            # Copy only the review checklist, never arbitrary personal data from the caller.
            evidence['review'] = {k: review[k] for k in ('confirmed', 'parent_checked', 'attributes_checked', 'reference')}
            row.evidence = evidence
        row.state, row.operation_source, row.reason, row.actor = target, source, reason, actor
        self.db.flush()  # Trigger writes the state event in this same transaction.
        self.db.refresh(row)
        return self._result(row, target)

    def verify(self, mapping_id: int, **kwargs) -> Result:
        return self.transition(mapping_id, 'verified', **kwargs)

    def reject(self, mapping_id: int, **kwargs) -> Result:
        return self.transition(mapping_id, 'rejected', **kwargs)

    def revoke(self, mapping_id: int, **kwargs) -> Result:
        return self.transition(mapping_id, 'revoked', **kwargs)
