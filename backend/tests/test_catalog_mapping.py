from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from pathlib import Path
from threading import Barrier
from uuid import UUID, uuid4

from alembic import command
from alembic.config import Config
import pytest
from sqlalchemy import event, func, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.models import CatalogMappingEvent as Event, CatalogVariantMapping as Mapping, Category, Inventory, Product, ProductVariant
from app.services.catalog_mapping import CatalogMappingService, uuid_id
from app.services.catalog_mapping_policy import assess, catalog_diagnostics
from app.services.catalog_mapping_sources import PrismaMappingSource
from test_integrity_agent import postgres  # noqa: F401

CONTEXT = {'source': 'test-review', 'reason': 'Synthetic catalog reconciliation'}
REVIEW = {'confirmed': True, 'parent_checked': True, 'attributes_checked': True, 'reference': 'synthetic-import-record:17'}


@pytest.fixture
def catalogs(postgres, legacy):
    engine, _ = postgres
    path, ids = legacy
    source = PrismaMappingSource(path.resolve(), 'prisma-primary-test')
    before = path.read_bytes()
    with Session(engine) as db:
        product = Product(name='Different name is not identity', sku='KEY-1', price='199.90', stock=37,
                          category=Category(name='Synthetic', slug='synthetic'))
        variant = ProductVariant(product=product, sku='KEY-1-B', name='Default', color='Preto', color_hex='#000000',
                                 size='M', price='201.00')
        variant.inventory = Inventory(quantity_available=9, quantity_reserved=2)
        other = ProductVariant(product=product, sku='OTHER', name='Other', price='10.00')
        db.add_all([variant, other])
        db.commit()
        pg_id, other_id = variant.public_id, other.public_id
    yield engine, source, UUID(ids['variant']), pg_id, other_id
    # All source reads, reviews and resolutions must leave Prisma untouched.
    assert path.read_bytes() == before


def create(db, source, prisma_id, pg_id):
    result = CatalogMappingService(db, source).candidate(prisma_id, pg_id, **CONTEXT)
    assert result.status == 'pending'
    db.commit()
    return result.mapping_id


def test_explicit_review_lifecycle_and_audit(catalogs):
    engine, source, prisma_id, pg_id, _ = catalogs
    with Session(engine) as db:
        svc = CatalogMappingService(db, source)
        assert svc.by_prisma(prisma_id).status == 'not_found'
        assert svc.by_postgres(pg_id).status == 'not_found'
        identifier = create(db, source, prisma_id, pg_id)
        pending = svc.by_prisma(prisma_id)
        assert pending.status == 'pending' and pending.postgres_variant_public_id is None
        assert svc.verify(identifier, **CONTEXT).status == 'conflict'
        db.commit()
        assert svc.state(identifier).state == 'candidate'
        assert svc.verify(identifier, review=REVIEW, **CONTEXT).status == 'verified'
        db.commit()
        for resolved in (svc.by_prisma(prisma_id), svc.by_postgres(pg_id)):
            assert resolved.status == 'verified'
            assert resolved.prisma_variant_id == prisma_id and resolved.postgres_variant_public_id == pg_id
            assert set(resolved.assessment.differences) >= {'price', 'available', 'reserved'}
        assert svc.state(identifier).postgres_variant_public_id is None  # State lookup cannot bypass validation.
        assert svc.revoke(identifier, **CONTEXT).status == 'revoked'
        db.commit()
        revoked = svc.by_prisma(prisma_id)
        assert revoked.status == 'revoked' and revoked.postgres_variant_public_id is None
        events = db.scalars(select(Event).order_by(Event.id)).all()
        assert [e.event_type for e in events] == ['MappingCandidateCreated', 'MappingConflictDetected',
                                                 'MappingVerified', 'MappingRevoked']
        assert [(e.previous_state, e.next_state) for e in events] == [
            (None, 'candidate'), ('candidate', 'candidate'), ('candidate', 'verified'), ('verified', 'revoked')]
        assert all(e.actor is None and e.occurred_at is not None for e in events)
        assert db.scalar(select(Inventory.quantity_available).where(Inventory.variant_id == 1)) == 9
        assert db.scalar(select(Product.stock)) == 37


def test_rejected_history_does_not_resolve_and_allows_new_candidate(catalogs):
    engine, source, prisma_id, pg_id, _ = catalogs
    with Session(engine) as db:
        svc = CatalogMappingService(db, source)
        old = create(db, source, prisma_id, pg_id)
        assert svc.reject(old, **CONTEXT).status == 'rejected'
        db.commit()
        assert svc.by_postgres(pg_id).status == 'rejected'
        assert svc.verify(old, review=REVIEW, **CONTEXT).status == 'conflict'
        db.commit()
        new = create(db, source, prisma_id, pg_id)
        assert old != new and svc.by_prisma(prisma_id).mapping_id == new
        assert db.scalar(select(func.count()).select_from(Mapping)) == 2
        assert db.get(Mapping, old).state == 'rejected'


@pytest.mark.parametrize('target', ['candidate', 'revoked', 'unknown'])
def test_invalid_candidate_transitions_are_audited(catalogs, target):
    engine, source, prisma_id, pg_id, _ = catalogs
    with Session(engine) as db:
        svc = CatalogMappingService(db, source)
        identifier = create(db, source, prisma_id, pg_id)
        assert svc.transition(identifier, target, **CONTEXT).status == 'conflict'
        db.commit()
        assert db.get(Mapping, identifier).state == 'candidate'
        assert db.scalar(select(Event.event_type).order_by(Event.id.desc()).limit(1)) == 'MappingConflictDetected'


@pytest.mark.parametrize('side', ['prisma', 'postgres'])
def test_active_duplicates_are_conflicts_with_audit(catalogs, side):
    engine, source, prisma_id, pg_id, other_id = catalogs
    with Session(engine) as db:
        create(db, source, prisma_id, pg_id)
        # A new external reference still cannot claim the existing local variant.
        if side == 'postgres':
            class OtherSource:
                namespace = source.namespace

                def snapshot(self, identifier):
                    return replace(source.snapshot(prisma_id), variant_id=str(identifier))
            svc = CatalogMappingService(db, OtherSource())
            result = svc.candidate(uuid4(), pg_id, **CONTEXT)
        else:
            result = CatalogMappingService(db, source).candidate(prisma_id, other_id, **CONTEXT)
        assert result.status == 'conflict'
        db.commit()
        assert db.scalar(select(func.count()).select_from(Mapping)) == 1
        assert db.scalar(select(func.count()).select_from(Event).where(Event.event_type == 'MappingConflictDetected')) == 1


@pytest.mark.parametrize('bad', [1, '1', 'not-a-uuid', None, True])
def test_no_artificial_uuid_conversion(bad):
    with pytest.raises((ValueError, TypeError)):
        uuid_id(bad)


def test_id_namespaces_and_missing_sources(catalogs):
    engine, source, prisma_id, pg_id, _ = catalogs
    with Session(engine) as db:
        svc = CatalogMappingService(db, source)
        assert svc.by_postgres(prisma_id).status == 'not_found'
        assert svc.by_prisma(pg_id).status == 'not_found'
        assert svc.candidate(uuid4(), pg_id, **CONTEXT).status == 'inconsistent'
        assert svc.candidate(prisma_id, uuid4(), **CONTEXT).status == 'inconsistent'
        identifier = create(db, source, prisma_id, pg_id)
        svc.verify(identifier, review=REVIEW, **CONTEXT)
        db.commit()
        source.path = source.path.with_name('absent.db')
        result = svc.by_prisma(prisma_id)
        assert result.status == 'inconsistent' and result.detail == 'source_unavailable'
        assert result.postgres_variant_public_id is None


def test_orphaned_prisma_reference_fails_closed(catalogs):
    engine, source, prisma_id, pg_id, _ = catalogs
    with Session(engine) as db:
        identifier = create(db, source, prisma_id, pg_id)
        svc = CatalogMappingService(db, source)
        svc.verify(identifier, review=REVIEW, **CONTEXT)
        db.commit()
        class MissingSource:
            namespace = source.namespace

            def snapshot(self, identifier):
                return None
        result = CatalogMappingService(db, MissingSource()).by_prisma(prisma_id)
        assert result.status == 'inconsistent' and result.prisma_variant_id is None
        report = CatalogMappingService(db, MissingSource()).audit_links()
        assert len(report) == 1 and report[0].status == 'inconsistent'


def test_drift_is_detected_even_with_cached_orm_objects(catalogs):
    engine, source, prisma_id, pg_id, _ = catalogs
    with Session(engine) as db:
        identifier = create(db, source, prisma_id, pg_id)
        svc = CatalogMappingService(db, source)
        svc.verify(identifier, review=REVIEW, **CONTEXT)
        db.commit()
        assert svc.by_prisma(prisma_id).status == 'verified'
        with engine.begin() as connection:
            connection.execute(text("UPDATE product_variants SET color = 'Azul' WHERE public_id = :id"), {'id': pg_id})
        result = svc.by_prisma(prisma_id)
        assert result.status == 'inconsistent' and result.postgres_variant_public_id is None


def test_database_constraints_and_append_only_history(catalogs):
    engine, source, prisma_id, pg_id, _ = catalogs
    with Session(engine) as db:
        identifier = create(db, source, prisma_id, pg_id)
    statements = [
        "UPDATE catalog_variant_mappings SET state='revoked'",
        "UPDATE catalog_variant_mappings SET state='verified', evidence='{}'::jsonb",
        "UPDATE catalog_variant_mappings SET prisma_variant_id=gen_random_uuid()",
        "DELETE FROM catalog_variant_mappings",
        "TRUNCATE catalog_variant_mappings CASCADE",
        "UPDATE catalog_mapping_events SET reason='rewrite'",
        "DELETE FROM catalog_mapping_events",
        "TRUNCATE catalog_mapping_events",
        "DELETE FROM product_variants WHERE id=1",
    ]
    for statement in statements:
        with engine.begin() as connection:
            with connection.begin_nested() as savepoint:
                with pytest.raises(DBAPIError):
                    connection.execute(text(statement))
                savepoint.rollback()
    with Session(engine) as db:
        original = db.get(Mapping, identifier)
        values = {key: getattr(original, key) for key in (
            'prisma_source', 'prisma_variant_id', 'postgres_variant_public_id', 'source',
            'operation_source', 'reason', 'evidence')}
        for overrides in ({}, {'prisma_variant_id': uuid4()}, {'postgres_variant_public_id': uuid4()}):
            with pytest.raises(DBAPIError):
                with db.begin_nested():
                    db.add(Mapping(**(values | overrides)))
                    db.flush()
        with pytest.raises(DBAPIError, match='state audit'):
            with db.begin_nested():
                db.add(Event(mapping_id=identifier, event_type='MappingVerified', previous_state='candidate',
                             next_state='verified', operation_source='manual-sql', reason='fake', evidence={}))
                db.flush()
        assert db.scalar(select(func.count()).select_from(Event)) == 1


def test_audit_failure_rolls_back_state(catalogs):
    engine, source, prisma_id, pg_id, _ = catalogs
    with Session(engine) as db:
        identifier = create(db, source, prisma_id, pg_id)
    # Cause a real database failure inside the trigger's audit INSERT.
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE catalog_mapping_events ADD CONSTRAINT test_fail_verified "
                                "CHECK (event_type <> 'MappingVerified')"))
    with Session(engine) as db:
        with pytest.raises(DBAPIError):
            CatalogMappingService(db, source).verify(identifier, review=REVIEW, **CONTEXT)
        db.rollback()
        assert db.get(Mapping, identifier).state == 'candidate'
        assert db.scalar(select(func.count()).select_from(Event)) == 1


def test_caller_rollback_reverts_mapping_and_event(catalogs):
    engine, source, prisma_id, pg_id, _ = catalogs
    with Session(engine) as db:
        CatalogMappingService(db, source).candidate(prisma_id, pg_id, **CONTEXT)
        db.rollback()
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Mapping)) == 0
        assert db.scalar(select(func.count()).select_from(Event)) == 0


def test_concurrent_verification_has_one_winner(catalogs):
    engine, source, prisma_id, pg_id, _ = catalogs
    with Session(engine) as db:
        identifier = create(db, source, prisma_id, pg_id)
    barrier = Barrier(2)

    def verify(_):
        with Session(engine) as db:
            barrier.wait(timeout=10)
            result = CatalogMappingService(db, source).verify(identifier, review=REVIEW, **CONTEXT)
            db.commit()
            return result.status

    with ThreadPoolExecutor(max_workers=2) as executor:
        assert sorted(executor.map(verify, range(2))) == ['conflict', 'verified']
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Event).where(Event.event_type == 'MappingVerified')) == 1


def test_concurrent_candidate_creation_preserves_active_uniqueness(catalogs):
    engine, source, prisma_id, pg_id, _ = catalogs
    barrier = Barrier(2)

    def insert(_):
        with Session(engine) as db:
            barrier.wait(timeout=10)
            result = CatalogMappingService(db, source).candidate(prisma_id, pg_id, **CONTEXT)
            db.commit()
            return result.status

    with ThreadPoolExecutor(max_workers=2) as executor:
        assert sorted(executor.map(insert, range(2))) == ['conflict', 'pending']
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Mapping)) == 1
        assert db.scalar(select(func.count()).select_from(Event)) == 2


def test_migration_empty_downgrade_and_refusal_to_erase_history(catalogs):
    engine, source, prisma_id, pg_id, _ = catalogs
    config = Config(str(Path(__file__).resolve().parents[1] / 'alembic.ini'))
    with engine.connect() as connection:
        before = connection.execute(text('SELECT id, public_id, sku, price FROM product_variants ORDER BY id')).all()
    command.downgrade(config, 'd1e2f3a4b5c6')
    command.upgrade(config, 'head')
    command.check(config)
    with engine.connect() as connection:
        assert connection.execute(text('SELECT id, public_id, sku, price FROM product_variants ORDER BY id')).all() == before
    with Session(engine) as db:
        create(db, source, prisma_id, pg_id)
    with pytest.raises(RuntimeError, match='Refusing downgrade'):
        command.downgrade(config, 'd1e2f3a4b5c6')
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Event)) == 1


def test_assessment_is_not_automatic_verification(catalogs):
    engine, source, prisma_id, pg_id, _ = catalogs
    left = source.snapshot(prisma_id)
    with Session(engine) as db:
        svc = CatalogMappingService(db, source)
        right = svc._pg_snapshot(pg_id)
        assert assess(left, right).classification == 'verifiable'
        assert assess(None, right).classification == 'absent'
        assert assess(replace(left, normalized_sku_count=2), right).classification == 'ambiguous'
        assert assess(replace(left, active=False), right).classification == 'incompatible'
        assert assess(replace(left, parent_sku=None), right).classification == 'potential'
        assert assess(replace(left, sku=' key-1-b '), right).classification == 'verifiable'
        assert svc.by_prisma(prisma_id).status == 'not_found'
        diagnostics = source.diagnostics()
        assert diagnostics['variants'] == 1 and diagnostics['orphan_variants'] == 0
        assert svc.postgres_diagnostics()['variants'] == 2


def test_diagnostics_find_unicode_collisions_orphans_and_missing_variants():
    facts = catalog_diagnostics([{'id': 'p', 'status': 'ARCHIVED'}, {'id': 'empty', 'status': 'ACTIVE'}], [
        {'id': 'a', 'product_id': 'p', 'sku': 'ＫＥＹ', 'is_active': True},
        {'id': 'b', 'product_id': 'p', 'sku': ' key ', 'is_active': False},
        {'id': 'c', 'product_id': 'missing', 'sku': ' ', 'is_active': True},
    ])
    assert facts['duplicate_normalized_skus'] == 1
    assert facts['missing_sku'] == facts['orphan_variants'] == facts['products_without_variants'] == 1


def test_same_uuid_in_two_sources_is_not_implicit_equivalence(catalogs):
    engine, source, prisma_id, pg_id, _ = catalogs
    with Session(engine) as db:
        product = db.scalar(select(Product))
        db.add(ProductVariant(product=product, public_id=prisma_id, sku='UUID-COLLISION', name='Unrelated', price='1.00'))
        db.commit()
        svc = CatalogMappingService(db, source)
        create(db, source, prisma_id, pg_id)
        assert svc.by_postgres(prisma_id).status == 'not_found'
        assert svc.by_prisma(prisma_id).status == 'pending'


def test_audit_scan_detects_orphans_in_pending_and_terminal_history(catalogs):
    engine, source, prisma_id, pg_id, _ = catalogs
    with Session(engine) as db:
        identifier = create(db, source, prisma_id, pg_id)
        class MissingSource:
            namespace = source.namespace

            def snapshot(self, identifier):
                return None
        audit = CatalogMappingService(db, MissingSource())
        assert audit.audit_links()[0].status == 'inconsistent'
        CatalogMappingService(db, source).reject(identifier, **CONTEXT)
        db.commit()
        report = audit.audit_links()[0]
        assert report.state == 'rejected' and report.status == 'inconsistent'
        assert audit.audit_links(after_id=identifier) == []


def test_external_revocation_is_observed_with_cached_mapping(catalogs):
    engine, source, prisma_id, pg_id, _ = catalogs
    with Session(engine) as db:
        identifier = create(db, source, prisma_id, pg_id)
        svc = CatalogMappingService(db, source)
        svc.verify(identifier, review=REVIEW, **CONTEXT)
        db.commit()
        cached = db.get(Mapping, identifier)
        assert cached.state == 'verified'
        with Session(engine) as other:
            CatalogMappingService(other, source).revoke(identifier, **CONTEXT)
            other.commit()
        result = svc.by_prisma(prisma_id)
        assert result.status == 'revoked' and result.postgres_variant_public_id is None
        assert cached.state == 'revoked'


def test_duplicate_conflict_uses_state_committed_by_another_session(catalogs):
    engine, source, prisma_id, pg_id, _ = catalogs
    with Session(engine) as db:
        identifier = create(db, source, prisma_id, pg_id)
        cached = db.get(Mapping, identifier)
        assert cached.state == 'candidate'
        with Session(engine) as other:
            CatalogMappingService(other, source).verify(identifier, review=REVIEW, **CONTEXT)
            other.commit()
        result = CatalogMappingService(db, source).candidate(prisma_id, pg_id, **CONTEXT)
        assert result.status == 'conflict' and result.state == 'verified'
        db.commit()
        last = db.scalar(select(Event).order_by(Event.id.desc()).limit(1))
        assert last.event_type == 'MappingConflictDetected'
        assert last.previous_state == last.next_state == 'verified'


def test_conflict_is_audited_when_competing_link_becomes_terminal(catalogs):
    engine, source, prisma_id, pg_id, _ = catalogs
    with Session(engine) as db:
        identifier = create(db, source, prisma_id, pg_id)
        changed = []

        def reject_between_duplicate_failure_and_conflict_lookup(session, transaction):
            if transaction.nested and not changed:
                changed.append(True)
                with Session(engine) as other:
                    CatalogMappingService(other, source).reject(identifier, **CONTEXT)
                    other.commit()

        event.listen(db, 'after_transaction_end', reject_between_duplicate_failure_and_conflict_lookup)
        try:
            result = CatalogMappingService(db, source).candidate(prisma_id, pg_id, **CONTEXT)
        finally:
            event.remove(db, 'after_transaction_end', reject_between_duplicate_failure_and_conflict_lookup)
        assert changed and result.status == 'conflict' and result.state == 'rejected'
        db.commit()
        last = db.scalar(select(Event).order_by(Event.id.desc()).limit(1))
        assert last.event_type == 'MappingConflictDetected'
        assert last.previous_state == last.next_state == 'rejected'


@pytest.mark.parametrize('change', [
    {'active': False}, {'parent_active': False}, {'normalized_sku_count': 2}, {'parent_sku': None},
    {'attributes': {'color': 'Azul', 'color_hex': '#000000', 'size': 'M', 'model': None}},
])
def test_review_cannot_override_incompatible_or_ambiguous_evidence(catalogs, change):
    engine, source, prisma_id, pg_id, _ = catalogs
    with Session(engine) as db:
        identifier = create(db, source, prisma_id, pg_id)
        class ChangedSource:
            namespace = source.namespace

            def snapshot(self, identifier):
                return replace(source.snapshot(identifier), **change)
        svc = CatalogMappingService(db, ChangedSource())
        assert svc.verify(identifier, review=REVIEW, **CONTEXT).status == 'conflict'
        db.commit()
        assert svc.state(identifier).state == 'candidate'
