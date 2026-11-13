"""Temporary identity links. PostgreSQL migrations install the history guards."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, JSON, String, Text, Uuid, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

DOCUMENT = JSON().with_variant(JSONB(), 'postgresql')
ACTIVE = "state IN ('candidate', 'verified')"


class CatalogVariantMapping(Base):
    __tablename__ = 'catalog_variant_mappings'
    __table_args__ = (
        CheckConstraint("state IN ('candidate', 'verified', 'rejected', 'revoked')", name='ck_mapping_state'),
        CheckConstraint("length(trim(prisma_source)) > 0 AND length(trim(source)) > 0 "
                        "AND length(trim(operation_source)) > 0 AND length(trim(reason)) > 0", name='ck_mapping_context'),
        Index('uq_mapping_active_prisma', 'prisma_source', 'prisma_variant_id', unique=True,
              postgresql_where=text(ACTIVE), sqlite_where=text(ACTIVE)),
        Index('uq_mapping_active_postgres', 'postgres_variant_public_id', unique=True,
              postgresql_where=text(ACTIVE), sqlite_where=text(ACTIVE)),
        Index('ix_mapping_prisma_history', 'prisma_source', 'prisma_variant_id', 'id'),
        Index('ix_mapping_postgres_history', 'postgres_variant_public_id', 'id'),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    prisma_source: Mapped[str] = mapped_column(String(80), nullable=False)
    prisma_variant_id: Mapped[UUID] = mapped_column(Uuid(), nullable=False)
    postgres_variant_public_id: Mapped[UUID] = mapped_column(
        Uuid(), ForeignKey('product_variants.public_id', name='fk_mapping_postgres_variant', ondelete='RESTRICT'),
        nullable=False,
    )
    state: Mapped[str] = mapped_column(String(20), nullable=False, default='candidate', server_default='candidate')
    source: Mapped[str] = mapped_column(String(120), nullable=False)
    operation_source: Mapped[str] = mapped_column(String(120), nullable=False)
    actor: Mapped[str | None] = mapped_column(String(120))
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[dict] = mapped_column(DOCUMENT, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class CatalogMappingEvent(Base):
    __tablename__ = 'catalog_mapping_events'
    __table_args__ = (
        CheckConstraint("event_type IN ('MappingCandidateCreated', 'MappingVerified', 'MappingRejected', "
                        "'MappingRevoked', 'MappingConflictDetected')", name='ck_mapping_event_type'),
        Index('ix_mapping_events_history', 'mapping_id', 'id'),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    mapping_id: Mapped[int] = mapped_column(
        ForeignKey('catalog_variant_mappings.id', name='fk_mapping_event_mapping', ondelete='RESTRICT'), nullable=False,
    )
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    previous_state: Mapped[str | None] = mapped_column(String(20))
    next_state: Mapped[str] = mapped_column(String(20), nullable=False)
    operation_source: Mapped[str] = mapped_column(String(120), nullable=False)
    actor: Mapped[str | None] = mapped_column(String(120))
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[dict] = mapped_column(DOCUMENT, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
