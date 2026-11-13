"""Add the opt-in PostgreSQL checkout/order transaction boundary.

The tables coexist with the Prisma/SQLite writer.  No existing Prisma data is
copied, changed, or made authoritative by this migration.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f6b7c8d9e0f1'
down_revision: Union[str, Sequence[str], None] = 'f5a6b7c8d9e0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'orders',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('public_id', sa.Uuid(), nullable=False),
        sa.Column('customer_id', sa.String(255), nullable=False),
        sa.Column('idempotency_scope', sa.String(320), nullable=False),
        sa.Column('idempotency_key', sa.String(200), nullable=False),
        sa.Column('request_hash', sa.String(64), nullable=False),
        sa.Column('reservation_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(30), nullable=False, server_default='pending_payment'),
        sa.Column('currency', sa.String(3), nullable=False, server_default='BRL'),
        sa.Column('subtotal', sa.Numeric(12, 2), nullable=False),
        sa.Column('discount_amount', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('shipping_amount', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('total', sa.Numeric(12, 2), nullable=False),
        sa.Column('shipping_option', sa.String(160), nullable=False),
        sa.Column('shipping_address', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['reservation_id'], ['stock_reservations.id'], ondelete='RESTRICT'),
        sa.UniqueConstraint('public_id', name='uq_orders_public_id'),
        sa.UniqueConstraint('idempotency_scope', 'idempotency_key', name='uq_orders_idempotency'),
        sa.UniqueConstraint('reservation_id', name='uq_orders_reservation_id'),
        sa.CheckConstraint("status IN ('pending_payment', 'paid', 'cancelled', 'expired')", name='ck_orders_status'),
        sa.CheckConstraint('subtotal >= 0 AND discount_amount >= 0 AND shipping_amount >= 0 AND total >= 0',
                           name='ck_orders_amounts_nonnegative'),
    )
    op.create_index('ix_orders_customer_created', 'orders', ['customer_id', 'created_at', 'id'])

    op.create_table(
        'order_items',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('variant_id', sa.Integer(), nullable=False),
        sa.Column('variant_public_id', sa.Uuid(), nullable=False),
        sa.Column('product_name', sa.String(150), nullable=False),
        sa.Column('variant_name', sa.String(150), nullable=False),
        sa.Column('sku', sa.String(120), nullable=False),
        sa.Column('unit_price', sa.Numeric(12, 2), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('line_total', sa.Numeric(12, 2), nullable=False),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['variant_id'], ['product_variants.id'], ondelete='RESTRICT'),
        sa.CheckConstraint('quantity > 0', name='ck_order_items_quantity_positive'),
        sa.CheckConstraint('unit_price >= 0 AND line_total >= 0', name='ck_order_items_amounts_nonnegative'),
    )
    op.create_index('ix_order_items_variant', 'order_items', ['variant_id'])

    op.create_table(
        'payment_attempts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(80), nullable=False),
        sa.Column('method', sa.String(30), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('provider_payment_id', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('provider_payment_id', name='uq_payment_attempts_provider_payment_id'),
        sa.CheckConstraint("status IN ('pending', 'paid', 'failed', 'cancelled')", name='ck_payment_attempts_status'),
        sa.CheckConstraint('amount >= 0', name='ck_payment_attempts_amount_nonnegative'),
    )
    op.create_index('ix_payment_attempts_order_created', 'payment_attempts', ['order_id', 'created_at'])

    op.create_table(
        'order_status_history',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(30), nullable=False),
        sa.Column('reason', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_order_status_history_order_created', 'order_status_history', ['order_id', 'created_at'])

    op.create_table(
        'order_outbox_events',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('event_key', sa.String(320), nullable=False),
        sa.Column('event_type', sa.String(80), nullable=False),
        sa.Column('payload', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('event_key', name='uq_order_outbox_event_key'),
    )
    op.create_index('ix_order_outbox_pending', 'order_outbox_events', ['published_at', 'created_at'])


def downgrade() -> None:
    bind = op.get_bind()
    if bind.execute(sa.text('SELECT count(*) FROM orders')).scalar_one():
        raise RuntimeError('Refusing downgrade with PostgreSQL checkout orders.')
    op.drop_index('ix_order_outbox_pending', table_name='order_outbox_events')
    op.drop_table('order_outbox_events')
    op.drop_index('ix_order_status_history_order_created', table_name='order_status_history')
    op.drop_table('order_status_history')
    op.drop_index('ix_payment_attempts_order_created', table_name='payment_attempts')
    op.drop_table('payment_attempts')
    op.drop_index('ix_order_items_variant', table_name='order_items')
    op.drop_table('order_items')
    op.drop_index('ix_orders_customer_created', table_name='orders')
    op.drop_table('orders')
