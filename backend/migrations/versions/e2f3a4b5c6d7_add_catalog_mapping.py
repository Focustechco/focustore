"""Add explicit variant links and append-only transactional audit.

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
No existing catalog data is updated and no links are inferred.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = 'e2f3a4b5c6d7'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None

DOCUMENT = sa.JSON().with_variant(JSONB(), 'postgresql')


def upgrade():
    op.create_table(
        'catalog_variant_mappings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('prisma_source', sa.String(80), nullable=False),
        sa.Column('prisma_variant_id', sa.Uuid(), nullable=False),
        sa.Column('postgres_variant_public_id', sa.Uuid(), nullable=False),
        sa.Column('state', sa.String(20), nullable=False, server_default='candidate'),
        sa.Column('source', sa.String(120), nullable=False),
        sa.Column('operation_source', sa.String(120), nullable=False),
        sa.Column('actor', sa.String(120)),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('evidence', DOCUMENT, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['postgres_variant_public_id'], ['product_variants.public_id'],
                                name='fk_mapping_postgres_variant', ondelete='RESTRICT'),
        sa.CheckConstraint("state IN ('candidate', 'verified', 'rejected', 'revoked')", name='ck_mapping_state'),
        sa.CheckConstraint("length(trim(prisma_source)) > 0 AND length(trim(source)) > 0 "
                           "AND length(trim(operation_source)) > 0 AND length(trim(reason)) > 0", name='ck_mapping_context'),
    )
    for name, columns in (
        ('uq_mapping_active_prisma', ['prisma_source', 'prisma_variant_id']),
        ('uq_mapping_active_postgres', ['postgres_variant_public_id']),
    ):
        op.create_index(name, 'catalog_variant_mappings', columns, unique=True,
                        postgresql_where=sa.text("state IN ('candidate', 'verified')"),
                        sqlite_where=sa.text("state IN ('candidate', 'verified')"))
    op.create_index('ix_mapping_prisma_history', 'catalog_variant_mappings', ['prisma_source', 'prisma_variant_id', 'id'])
    op.create_index('ix_mapping_postgres_history', 'catalog_variant_mappings', ['postgres_variant_public_id', 'id'])
    op.create_table(
        'catalog_mapping_events',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('mapping_id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(40), nullable=False),
        sa.Column('previous_state', sa.String(20)),
        sa.Column('next_state', sa.String(20), nullable=False),
        sa.Column('operation_source', sa.String(120), nullable=False),
        sa.Column('actor', sa.String(120)),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('evidence', DOCUMENT, nullable=False),
        sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['mapping_id'], ['catalog_variant_mappings.id'],
                                name='fk_mapping_event_mapping', ondelete='RESTRICT'),
        sa.CheckConstraint("event_type IN ('MappingCandidateCreated', 'MappingVerified', 'MappingRejected', "
                           "'MappingRevoked', 'MappingConflictDetected')", name='ck_mapping_event_type'),
    )
    op.create_index('ix_mapping_events_history', 'catalog_mapping_events', ['mapping_id', 'id'])
    if op.get_bind().dialect.name != 'postgresql':
        return  # SQLite is only used by existing isolated contract tests.

    op.execute('''
        CREATE FUNCTION mapping_prevent_history_change() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'mapping history is append-only'; END;
        $$ LANGUAGE plpgsql
    ''')
    op.execute('''
        CREATE FUNCTION mapping_guard_write() RETURNS trigger AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                IF NEW.state <> 'candidate' THEN
                    RAISE EXCEPTION 'mapping must start as candidate';
                END IF;
                NEW.created_at := statement_timestamp();
            ELSE
                IF ROW(NEW.id, NEW.prisma_source, NEW.prisma_variant_id,
                       NEW.postgres_variant_public_id, NEW.source, NEW.created_at)
                   IS DISTINCT FROM ROW(OLD.id, OLD.prisma_source, OLD.prisma_variant_id,
                       OLD.postgres_variant_public_id, OLD.source, OLD.created_at) THEN
                    RAISE EXCEPTION 'mapping identity is immutable';
                END IF;
                IF NOT ((OLD.state = 'candidate' AND NEW.state IN ('verified', 'rejected'))
                     OR (OLD.state = 'verified' AND NEW.state = 'revoked')) THEN
                    RAISE EXCEPTION 'invalid mapping transition';
                END IF;
            END IF;
            IF NEW.state = 'verified' AND (
                jsonb_typeof(NEW.evidence) IS DISTINCT FROM 'object'
                OR NEW.evidence->'review'->'confirmed' IS DISTINCT FROM 'true'::jsonb
                OR NEW.evidence->'review'->'parent_checked' IS DISTINCT FROM 'true'::jsonb
                OR NEW.evidence->'review'->'attributes_checked' IS DISTINCT FROM 'true'::jsonb
                OR jsonb_typeof(NEW.evidence->'review'->'reference') IS DISTINCT FROM 'string'
                OR length(trim(NEW.evidence->'review'->>'reference')) = 0
                OR jsonb_typeof(NEW.evidence->'prisma') IS DISTINCT FROM 'object'
                OR jsonb_typeof(NEW.evidence->'postgres') IS DISTINCT FROM 'object'
                OR NEW.evidence->'prisma'->>'variant_id' IS DISTINCT FROM NEW.prisma_variant_id::text
                OR NEW.evidence->'postgres'->>'variant_id' IS DISTINCT FROM NEW.postgres_variant_public_id::text
                OR NEW.evidence->'prisma'->'active' IS DISTINCT FROM 'true'::jsonb
                OR NEW.evidence->'postgres'->'active' IS DISTINCT FROM 'true'::jsonb
                OR NEW.evidence->'prisma'->'parent_active' IS DISTINCT FROM 'true'::jsonb
                OR NEW.evidence->'postgres'->'parent_active' IS DISTINCT FROM 'true'::jsonb
                OR COALESCE(NEW.evidence->'prisma'->>'identity_hash', '') !~ '^[a-f0-9]{64}$'
                OR COALESCE(NEW.evidence->'postgres'->>'identity_hash', '') !~ '^[a-f0-9]{64}$'
            ) THEN
                RAISE EXCEPTION 'verified mapping requires explicit evidence';
            END IF;
            NEW.updated_at := statement_timestamp();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    ''')
    op.execute('''
        CREATE FUNCTION mapping_record_state_event() RETURNS trigger AS $$
        DECLARE kind text; previous text;
        BEGIN
            IF TG_OP = 'INSERT' THEN
                kind := 'MappingCandidateCreated'; previous := NULL;
            ELSE
                previous := OLD.state;
                kind := CASE NEW.state WHEN 'verified' THEN 'MappingVerified'
                        WHEN 'rejected' THEN 'MappingRejected' WHEN 'revoked' THEN 'MappingRevoked' END;
            END IF;
            INSERT INTO catalog_mapping_events
                (mapping_id, event_type, previous_state, next_state, operation_source, actor, reason, evidence)
            VALUES (NEW.id, kind, previous, NEW.state, NEW.operation_source, NEW.actor, NEW.reason, NEW.evidence);
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    ''')
    op.execute('''
        CREATE FUNCTION mapping_guard_event_insert() RETURNS trigger AS $$
        DECLARE current_state text;
        BEGIN
            IF NEW.event_type <> 'MappingConflictDetected' THEN
                IF pg_trigger_depth() < 2 THEN
                    RAISE EXCEPTION 'state audit must be generated by mapping trigger';
                END IF;
            ELSE
                SELECT state INTO current_state FROM catalog_variant_mappings WHERE id = NEW.mapping_id;
                IF NEW.previous_state IS DISTINCT FROM current_state OR NEW.next_state IS DISTINCT FROM current_state
                   OR length(trim(NEW.operation_source)) = 0 OR length(trim(NEW.reason)) = 0 THEN
                    RAISE EXCEPTION 'invalid conflict audit context';
                END IF;
            END IF;
            NEW.occurred_at := statement_timestamp();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    ''')
    op.execute('CREATE TRIGGER mapping_guard BEFORE INSERT OR UPDATE ON catalog_variant_mappings '
               'FOR EACH ROW EXECUTE FUNCTION mapping_guard_write()')
    op.execute('CREATE TRIGGER mapping_state_event AFTER INSERT OR UPDATE ON catalog_variant_mappings '
               'FOR EACH ROW EXECUTE FUNCTION mapping_record_state_event()')
    op.execute('CREATE TRIGGER mapping_event_insert BEFORE INSERT ON catalog_mapping_events '
               'FOR EACH ROW EXECUTE FUNCTION mapping_guard_event_insert()')
    for table, operations in (('catalog_variant_mappings', 'DELETE'), ('catalog_mapping_events', 'UPDATE OR DELETE')):
        op.execute(f'CREATE TRIGGER {table}_preserve BEFORE {operations} ON {table} '
                   'FOR EACH ROW EXECUTE FUNCTION mapping_prevent_history_change()')
        op.execute(f'CREATE TRIGGER {table}_no_truncate BEFORE TRUNCATE ON {table} '
                   'FOR EACH STATEMENT EXECUTE FUNCTION mapping_prevent_history_change()')


def downgrade():
    # Never silently discard accepted mappings or their audit history.
    bind = op.get_bind()
    if bind.execute(sa.text('SELECT count(*) FROM catalog_variant_mappings')).scalar_one():
        raise RuntimeError('Refusing downgrade with mapping history; archive and plan explicit retirement')
    op.drop_table('catalog_mapping_events')
    op.drop_table('catalog_variant_mappings')
    if bind.dialect.name == 'postgresql':
        for function in ('mapping_guard_event_insert', 'mapping_record_state_event',
                         'mapping_guard_write', 'mapping_prevent_history_change'):
            op.execute(f'DROP FUNCTION {function}()')
