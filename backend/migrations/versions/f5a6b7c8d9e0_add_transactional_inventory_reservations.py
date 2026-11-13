"""Add durable inventory reservations and movement history.

The existing ``inventory.quantity_available`` is the free-to-sell quantity;
physical stock is ``quantity_available + quantity_reserved``.  This revision
does not alter existing quantities or connect the tables to Prisma checkout.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f5a6b7c8d9e0'
down_revision: Union[str, Sequence[str], None] = 'e2f3a4b5c6d7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'stock_reservations',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('public_id', sa.Uuid(), nullable=False),
        sa.Column('idempotency_scope', sa.String(120), nullable=False),
        sa.Column('idempotency_key', sa.String(200), nullable=False),
        sa.Column('request_hash', sa.String(64), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('public_id', name='uq_stock_reservations_public_id'),
        sa.UniqueConstraint('idempotency_scope', 'idempotency_key', name='uq_stock_reservation_idempotency'),
        sa.CheckConstraint("status IN ('pending', 'confirmed', 'released', 'expired')", name='ck_stock_reservation_status'),
        sa.CheckConstraint('length(trim(idempotency_scope)) > 0', name='ck_stock_reservation_scope'),
        sa.CheckConstraint('length(trim(idempotency_key)) > 0', name='ck_stock_reservation_key'),
    )
    op.create_table(
        'stock_reservation_items',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('reservation_id', sa.Integer(), nullable=False),
        sa.Column('variant_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['reservation_id'], ['stock_reservations.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['variant_id'], ['product_variants.id'], ondelete='RESTRICT'),
        sa.UniqueConstraint('reservation_id', 'variant_id', name='uq_stock_reservation_item_variant'),
        sa.CheckConstraint('quantity > 0', name='ck_stock_reservation_item_quantity_positive'),
    )
    op.create_table(
        'inventory_movements',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('inventory_id', sa.Integer(), nullable=False),
        sa.Column('reservation_id', sa.Integer(), nullable=False),
        sa.Column('variant_id', sa.Integer(), nullable=False),
        sa.Column('operation', sa.String(20), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('source', sa.String(120), nullable=False),
        sa.Column('transaction_reference', sa.String(200), nullable=False),
        sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['inventory_id'], ['inventory.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['reservation_id'], ['stock_reservations.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['variant_id'], ['product_variants.id'], ondelete='RESTRICT'),
        sa.UniqueConstraint('reservation_id', 'variant_id', 'operation', name='uq_inventory_movement_operation'),
        sa.CheckConstraint("operation IN ('reserve', 'confirm', 'release', 'expire')", name='ck_inventory_movement_operation'),
        sa.CheckConstraint('quantity > 0', name='ck_inventory_movement_quantity_positive'),
    )
    op.create_index('ix_stock_reservation_status_expiry', 'stock_reservations', ['status', 'expires_at'])
    op.create_index('ix_stock_reservation_items_variant', 'stock_reservation_items', ['variant_id'])
    op.create_index('ix_inventory_movements_variant_time', 'inventory_movements', ['variant_id', 'occurred_at'])
    if op.get_bind().dialect.name == 'postgresql':
        op.execute('''
            CREATE FUNCTION focusstore_inventory_history_guard() RETURNS trigger AS $$
            BEGIN RAISE EXCEPTION 'inventory movement history is append-only'; END;
            $$ LANGUAGE plpgsql
        ''')
        op.execute('''
            CREATE TRIGGER inventory_movements_preserve BEFORE UPDATE OR DELETE ON inventory_movements
            FOR EACH ROW EXECUTE FUNCTION focusstore_inventory_history_guard()
        ''')


def downgrade() -> None:
    bind = op.get_bind()
    if bind.execute(sa.text('SELECT count(*) FROM inventory_movements')).scalar_one():
        raise RuntimeError('Refusing downgrade with inventory movement history.')
    if bind.dialect.name == 'postgresql':
        op.execute('DROP TRIGGER IF EXISTS inventory_movements_preserve ON inventory_movements')
        op.execute('DROP FUNCTION IF EXISTS focusstore_inventory_history_guard()')
    op.drop_index('ix_inventory_movements_variant_time', table_name='inventory_movements')
    op.drop_index('ix_stock_reservation_items_variant', table_name='stock_reservation_items')
    op.drop_index('ix_stock_reservation_status_expiry', table_name='stock_reservations')
    op.drop_table('inventory_movements')
    op.drop_table('stock_reservation_items')
    op.drop_table('stock_reservations')
