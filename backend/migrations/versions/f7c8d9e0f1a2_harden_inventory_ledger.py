"""Protect reservation state and append-only history without rewriting catalog data."""
from alembic import op
import sqlalchemy as sa

revision = 'f7c8d9e0f1a2'
down_revision = 'f6b7c8d9e0f1'
branch_labels = None
depends_on = None


def upgrade():
    # Preserve pre-existing reserved quantities without pretending they belong
    # to reservations managed by this service.
    with op.batch_alter_table('inventory') as batch:
        batch.add_column(sa.Column('unattributed_reserved', sa.Integer(), nullable=False, server_default='0'))
        batch.create_check_constraint('ck_inventory_unattributed_nonnegative', 'unattributed_reserved >= 0')
    op.execute('''UPDATE inventory SET unattributed_reserved = quantity_reserved - COALESCE((
        SELECT SUM(i.quantity) FROM stock_reservation_items i JOIN stock_reservations r ON r.id=i.reservation_id
        WHERE i.variant_id=inventory.variant_id AND r.status='pending'), 0)''')
    op.create_index('uq_inventory_movement_terminal', 'inventory_movements', ['reservation_id', 'variant_id'], unique=True,
                    postgresql_where=sa.text("operation IN ('confirm', 'release', 'expire')"),
                    sqlite_where=sa.text("operation IN ('confirm', 'release', 'expire')"))
    if op.get_bind().dialect.name != 'postgresql':
        return
    op.execute('''
        CREATE FUNCTION inventory_reserved_counter_guard() RETURNS trigger AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN NEW.unattributed_reserved := NEW.quantity_reserved;
            ELSIF ROW(NEW.id, NEW.variant_id) IS DISTINCT FROM ROW(OLD.id, OLD.variant_id)
            THEN RAISE EXCEPTION 'inventory identity is immutable';
            ELSIF NEW.unattributed_reserved IS DISTINCT FROM OLD.unattributed_reserved
            THEN RAISE EXCEPTION 'unattributed legacy reserve is immutable'; END IF;
            RETURN NEW;
        END; $$ LANGUAGE plpgsql
    ''')
    op.execute('CREATE TRIGGER inventory_reserved_baseline BEFORE INSERT OR UPDATE ON inventory '
               'FOR EACH ROW EXECUTE FUNCTION inventory_reserved_counter_guard()')
    op.execute('''
        CREATE FUNCTION inventory_check_reserved(vid integer) RETURNS void AS $$
        DECLARE actual bigint; baseline bigint; expected bigint;
        BEGIN
            SELECT quantity_reserved, unattributed_reserved INTO actual, baseline
                FROM inventory WHERE variant_id=vid FOR UPDATE;
            IF NOT FOUND THEN RAISE EXCEPTION 'reservation inventory missing'; END IF;
            SELECT COALESCE(SUM(i.quantity), 0) INTO expected FROM stock_reservation_items i
                JOIN stock_reservations r ON r.id=i.reservation_id
                WHERE i.variant_id=vid AND r.status='pending';
            IF actual <> baseline + expected THEN RAISE EXCEPTION 'reserved counter is inconsistent'; END IF;
        END; $$ LANGUAGE plpgsql
    ''')
    op.execute('''
        CREATE FUNCTION inventory_counter_consistency() RETURNS trigger AS $$
        BEGIN PERFORM inventory_check_reserved(NEW.variant_id); RETURN NULL; END;
        $$ LANGUAGE plpgsql
    ''')
    op.execute('CREATE CONSTRAINT TRIGGER inventory_counter_check AFTER INSERT OR UPDATE ON inventory '
               'DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_counter_consistency()')
    op.execute('''
        CREATE FUNCTION inventory_reservation_guard() RETURNS trigger AS $$
        BEGIN
            IF TG_OP = 'INSERT' THEN
                IF NEW.status <> 'pending' THEN RAISE EXCEPTION 'reservation must start pending'; END IF;
            ELSE
                IF ROW(NEW.public_id, NEW.idempotency_scope, NEW.idempotency_key, NEW.request_hash, NEW.created_at, NEW.id)
                   IS DISTINCT FROM ROW(OLD.public_id, OLD.idempotency_scope, OLD.idempotency_key, OLD.request_hash, OLD.created_at, OLD.id)
                THEN RAISE EXCEPTION 'reservation identity is immutable'; END IF;
                IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
                    OLD.status = 'pending' AND NEW.status IN ('confirmed', 'released', 'expired'))
                THEN RAISE EXCEPTION 'invalid reservation transition'; END IF;
                IF OLD.status <> 'pending' AND NEW.expires_at IS DISTINCT FROM OLD.expires_at
                THEN RAISE EXCEPTION 'terminal reservation deadline is immutable'; END IF;
            END IF;
            RETURN NEW;
        END; $$ LANGUAGE plpgsql
    ''')
    op.execute('CREATE TRIGGER reservation_guard BEFORE INSERT OR UPDATE ON stock_reservations '
               'FOR EACH ROW EXECUTE FUNCTION inventory_reservation_guard()')
    # Validate the final transaction state, not SQLAlchemy's statement ordering.
    op.execute('''
        CREATE FUNCTION inventory_ledger_consistency() RETURNS trigger AS $$
        DECLARE rid integer; current_state text; expected text; vid integer;
        BEGIN
            IF TG_TABLE_NAME = 'stock_reservations' THEN rid := NEW.id;
            ELSE rid := NEW.reservation_id; END IF;
            SELECT status INTO current_state FROM stock_reservations WHERE id = rid;
            expected := CASE current_state WHEN 'confirmed' THEN 'confirm'
                        WHEN 'released' THEN 'release' WHEN 'expired' THEN 'expire' END;
            IF NOT EXISTS (SELECT 1 FROM stock_reservation_items WHERE reservation_id = rid)
               OR EXISTS (
                SELECT 1 FROM stock_reservation_items i
                WHERE i.reservation_id = rid AND (
                    NOT EXISTS (SELECT 1 FROM inventory_movements m WHERE m.reservation_id=rid
                        AND m.variant_id=i.variant_id AND m.operation='reserve' AND m.quantity=i.quantity)
                    OR (expected IS NOT NULL AND NOT EXISTS (SELECT 1 FROM inventory_movements m
                        WHERE m.reservation_id=rid AND m.variant_id=i.variant_id AND m.operation=expected
                        AND m.quantity=i.quantity))))
               OR EXISTS (
                SELECT 1 FROM inventory_movements m
                LEFT JOIN stock_reservation_items i ON i.reservation_id=m.reservation_id AND i.variant_id=m.variant_id
                JOIN inventory s ON s.id=m.inventory_id
                WHERE m.reservation_id=rid AND (i.id IS NULL OR i.quantity<>m.quantity OR s.variant_id<>m.variant_id
                    OR (m.operation<>'reserve' AND m.operation IS DISTINCT FROM expected)))
            THEN RAISE EXCEPTION 'reservation ledger is inconsistent'; END IF;
            FOR vid IN SELECT variant_id FROM stock_reservation_items WHERE reservation_id=rid ORDER BY variant_id
            LOOP PERFORM inventory_check_reserved(vid); END LOOP;
            RETURN NULL;
        END; $$ LANGUAGE plpgsql
    ''')
    for table in ('stock_reservations', 'stock_reservation_items', 'inventory_movements'):
        op.execute(f'CREATE CONSTRAINT TRIGGER {table}_ledger_check AFTER INSERT OR UPDATE ON {table} '
                   'DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION inventory_ledger_consistency()')
    for table in ('stock_reservations', 'stock_reservation_items', 'inventory_movements'):
        op.execute(f'CREATE TRIGGER {table}_no_truncate BEFORE TRUNCATE ON {table} '
                   'FOR EACH STATEMENT EXECUTE FUNCTION focusstore_inventory_history_guard()')
    op.execute('CREATE TRIGGER reservation_no_delete BEFORE DELETE ON stock_reservations '
               'FOR EACH ROW EXECUTE FUNCTION focusstore_inventory_history_guard()')
    op.execute('CREATE TRIGGER reservation_items_preserve BEFORE UPDATE OR DELETE ON stock_reservation_items '
               'FOR EACH ROW EXECUTE FUNCTION focusstore_inventory_history_guard()')


def downgrade():
    bind = op.get_bind()
    if bind.execute(sa.text('SELECT count(*) FROM stock_reservations')).scalar_one():
        raise RuntimeError('Refusing to remove reservation integrity guards with existing history.')
    if bind.dialect.name == 'postgresql':
        for table in ('stock_reservations', 'stock_reservation_items', 'inventory_movements'):
            op.execute(f'DROP TRIGGER {table}_ledger_check ON {table}')
            op.execute(f'DROP TRIGGER {table}_no_truncate ON {table}')
        op.execute('DROP TRIGGER reservation_no_delete ON stock_reservations')
        op.execute('DROP TRIGGER reservation_items_preserve ON stock_reservation_items')
        op.execute('DROP TRIGGER reservation_guard ON stock_reservations')
        op.execute('DROP FUNCTION inventory_ledger_consistency()')
        op.execute('DROP FUNCTION inventory_reservation_guard()')
        op.execute('DROP TRIGGER inventory_counter_check ON inventory')
        op.execute('DROP TRIGGER inventory_reserved_baseline ON inventory')
        op.execute('DROP FUNCTION inventory_counter_consistency()')
        op.execute('DROP FUNCTION inventory_check_reserved(integer)')
        op.execute('DROP FUNCTION inventory_reserved_counter_guard()')
    op.drop_index('uq_inventory_movement_terminal', table_name='inventory_movements')
    with op.batch_alter_table('inventory') as batch:
        batch.drop_constraint('ck_inventory_unattributed_nonnegative', type_='check')
        batch.drop_column('unattributed_reserved')
