"""Add immutable public UUID identities to the PostgreSQL catalog.

Revision ID: d1e2f3a4b5c6
Revises: a7b8c9d0e1f2

The new identities are additive: integer primary and foreign keys remain
unchanged. Existing rows are backfilled before NOT NULL and uniqueness are
enforced. If an upgrade fails before completion, Alembic rolls back its
transaction on PostgreSQL; recovery is therefore to correct the failure and
rerun the upgrade, rather than downgrading a database that has accepted data.
"""

from typing import Sequence, Union
from uuid import uuid4

from alembic import context, op
import sqlalchemy as sa


revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, Sequence[str], None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


PUBLIC_ID = sa.Uuid(as_uuid=True)


def _table(name: str) -> sa.Table:
    return sa.table(
        name,
        sa.column('id', sa.Integer()),
        sa.column('public_id', PUBLIC_ID),
    )


def _backfill(name: str) -> None:
    bind = op.get_bind()
    table = _table(name)
    while True:
        identifiers = bind.execute(
            sa.select(table.c.id).where(table.c.public_id.is_(None)).limit(1000)
        ).scalars().all()
        if not identifiers:
            break
        bind.execute(
            table.update().where(table.c.id == sa.bindparam('identifier')).values(
                public_id=sa.bindparam('public_id')
            ),
            [{'identifier': identifier, 'public_id': uuid4()} for identifier in identifiers],
        )


def _enforce_column(name: str, constraint: str) -> None:
    if op.get_bind().dialect.name == 'sqlite':
        with op.batch_alter_table(name, recreate='always') as batch:
            batch.alter_column('public_id', existing_type=PUBLIC_ID, nullable=False)
            batch.create_unique_constraint(constraint, ['public_id'])
        return
    op.alter_column(name, 'public_id', existing_type=PUBLIC_ID, nullable=False)
    op.create_unique_constraint(constraint, name, ['public_id'])


def _create_immutability_guards() -> None:
    if op.get_bind().dialect.name == 'postgresql':
        op.execute('''
            CREATE FUNCTION focusstore_prevent_catalog_public_id_change()
            RETURNS trigger AS $$
            BEGIN
                IF NEW.public_id IS DISTINCT FROM OLD.public_id THEN
                    RAISE EXCEPTION 'catalog public_id is immutable';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        ''')
        for table in ('products', 'product_variants'):
            op.execute(f'''
                CREATE TRIGGER {table}_public_id_immutable
                BEFORE UPDATE OF public_id ON {table}
                FOR EACH ROW EXECUTE FUNCTION focusstore_prevent_catalog_public_id_change()
            ''')
        return
    for table in ('products', 'product_variants'):
        op.execute(f'''
            CREATE TRIGGER {table}_public_id_immutable
            BEFORE UPDATE OF public_id ON {table}
            FOR EACH ROW WHEN NEW.public_id IS NOT OLD.public_id
            BEGIN
                SELECT RAISE(ABORT, 'catalog public_id is immutable');
            END
        ''')


def _drop_immutability_guards() -> None:
    if op.get_bind().dialect.name == 'postgresql':
        for table in ('products', 'product_variants'):
            op.execute(f'DROP TRIGGER IF EXISTS {table}_public_id_immutable ON {table}')
        op.execute('DROP FUNCTION IF EXISTS focusstore_prevent_catalog_public_id_change()')
        return
    for table in ('products', 'product_variants'):
        op.execute(f'DROP TRIGGER IF EXISTS {table}_public_id_immutable')


def upgrade() -> None:
    if context.is_offline_mode():
        raise RuntimeError(
            'd1e2f3a4b5c6 requires an online connection to backfill random public UUIDs safely'
        )
    for table in ('products', 'product_variants'):
        op.add_column(table, sa.Column('public_id', PUBLIC_ID, nullable=True))
        _backfill(table)

    _enforce_column('products', 'uq_products_public_id')
    _enforce_column('product_variants', 'uq_product_variants_public_id')
    _create_immutability_guards()


def downgrade() -> None:
    _drop_immutability_guards()
    if op.get_bind().dialect.name == 'sqlite':
        for table, constraint in (
            ('product_variants', 'uq_product_variants_public_id'),
            ('products', 'uq_products_public_id'),
        ):
            with op.batch_alter_table(table, recreate='always') as batch:
                batch.drop_constraint(constraint, type_='unique')
                batch.drop_column('public_id')
        return
    op.drop_constraint('uq_product_variants_public_id', 'product_variants', type_='unique')
    op.drop_column('product_variants', 'public_id')
    op.drop_constraint('uq_products_public_id', 'products', type_='unique')
    op.drop_column('products', 'public_id')
