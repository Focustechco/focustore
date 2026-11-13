from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import CatalogMappingEvent, CatalogVariantMapping
from app.services.catalog_mapping import CatalogMappingService
from app.services.progressive_migration import dry_run
from test_integrity_agent import postgres  # noqa: F401
from test_catalog_mapping import CONTEXT  # noqa: F401
from test_catalog_mapping import catalogs  # noqa: F401


def test_reconciliation_is_bounded_and_read_only(catalogs):
    engine, source, prisma_id, postgres_id, _other_id = catalogs
    with Session(engine) as db:
        mapping_id = CatalogMappingService(db, source).candidate(prisma_id, postgres_id, **CONTEXT).mapping_id
        db.commit()
        before_mappings = db.scalar(select(func.count()).select_from(CatalogVariantMapping))
        before_events = db.scalar(select(func.count()).select_from(CatalogMappingEvent))
        report = dry_run(db, Path(source.path), source.namespace, limit=10)
        db.rollback()
        assert report.mode == 'dry-run'
        assert report.writes_performed is False
        assert report.authority_changes is False
        assert report.mappings_scanned == 1
        assert report.mapping_statuses == {'pending': 1}
        assert db.scalar(select(func.count()).select_from(CatalogVariantMapping)) == before_mappings
        assert db.scalar(select(func.count()).select_from(CatalogMappingEvent)) == before_events
        assert mapping_id is not None
