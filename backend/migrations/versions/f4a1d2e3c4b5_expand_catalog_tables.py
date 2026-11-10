"""Expand the PostgreSQL catalog without replacing the legacy tables.

Revision ID: f4a1d2e3c4b5
Revises: e0dd9a760a45
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f4a1d2e3c4b5'
down_revision: Union[str, Sequence[str], None] = 'e0dd9a760a45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _is_sqlite() -> bool:
    return op.get_bind().dialect.name == 'sqlite'


def _timestamp_default():
    # SQLite cannot add a column with CURRENT_TIMESTAMP as an ALTER TABLE
    # default. The value is only a compatibility placeholder for the local
    # migration test database; PostgreSQL receives the real current timestamp.
    return sa.text("'1970-01-01 00:00:00'") if _is_sqlite() else sa.func.now()


def _categories_copy_from(*, with_parent_foreign_key: bool = False) -> sa.Table:
    """Describe the category table for SQLite batch mode, including offline SQL.

    Alembic cannot reflect a SQLite table while generating ``--sql`` output.
    Keeping this definition aligned with the preceding revisions allows the
    same migration to be rendered offline and executed against a temporary
    SQLite database without weakening the PostgreSQL migration path.
    """
    metadata = sa.MetaData()
    constraints: list[sa.Constraint] = [
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug'),
    ]
    if with_parent_foreign_key:
        constraints.append(
            sa.ForeignKeyConstraint(
                ['parent_id'], ['categories.id'],
                name='fk_categories_parent_id', ondelete='SET NULL',
            )
        )
    return sa.Table(
        'categories', metadata,
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('slug', sa.String(length=140), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('image_url', sa.String(length=1000), nullable=True),
        sa.Column('parent_id', sa.Integer(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=_timestamp_default()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=_timestamp_default()),
        *constraints,
    )


def upgrade() -> None:
    # Existing rows are preserved. New catalog columns remain nullable until a
    # separately reviewed backfill establishes complete source mappings.
    op.add_column('categories', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('categories', sa.Column('image_url', sa.String(length=1000), nullable=True))
    op.add_column('categories', sa.Column('parent_id', sa.Integer(), nullable=True))
    op.add_column('categories', sa.Column('position', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('categories', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column('categories', sa.Column('created_at', sa.DateTime(), nullable=False, server_default=_timestamp_default()))
    op.add_column('categories', sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=_timestamp_default()))
    if _is_sqlite():
        with op.batch_alter_table(
            'categories', recreate='always', copy_from=_categories_copy_from()
        ) as batch:
            batch.create_foreign_key('fk_categories_parent_id', 'categories', ['parent_id'], ['id'], ondelete='SET NULL')
    else:
        op.create_foreign_key(
            'fk_categories_parent_id', 'categories', 'categories', ['parent_id'], ['id'], ondelete='SET NULL'
        )
    op.create_index('ix_categories_active_position', 'categories', ['is_active', 'position'])

    op.add_column('products', sa.Column('slug', sa.String(length=180), nullable=True))
    op.add_column('products', sa.Column('sku', sa.String(length=120), nullable=True))
    op.add_column('products', sa.Column('short_description', sa.Text(), nullable=True))
    op.add_column('products', sa.Column('brand', sa.String(length=120), nullable=False, server_default='Focus'))
    op.add_column('products', sa.Column('base_price', sa.Numeric(10, 2), nullable=True))
    op.add_column('products', sa.Column('promotional_price', sa.Numeric(10, 2), nullable=True))
    op.add_column('products', sa.Column('status', sa.String(length=30), nullable=False, server_default='ACTIVE'))
    op.add_column('products', sa.Column('is_featured', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('products', sa.Column('created_at', sa.DateTime(), nullable=False, server_default=_timestamp_default()))
    op.add_column('products', sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=_timestamp_default()))
    op.execute(sa.text("UPDATE products SET base_price = price WHERE base_price IS NULL"))
    op.execute(sa.text("UPDATE products SET sku = 'LEGACY-' || CAST(id AS VARCHAR) WHERE sku IS NULL"))
    op.execute(sa.text("UPDATE products SET slug = 'legacy-product-' || CAST(id AS VARCHAR) WHERE slug IS NULL"))
    op.create_index('ux_products_slug', 'products', ['slug'], unique=True)
    op.create_index('ux_products_sku', 'products', ['sku'], unique=True)
    op.create_index('ix_products_catalog_status', 'products', ['status', 'slug'])

    op.create_table(
        'product_categories',
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('product_id', 'category_id'),
    )
    op.create_index('ix_product_categories_category_id', 'product_categories', ['category_id'])

    op.create_table(
        'product_images',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('url', sa.String(length=1000), nullable=False),
        sa.Column('alt_text', sa.String(length=300), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_product_images_product_position', 'product_images', ['product_id', 'position'])

    op.create_table(
        'product_variants',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('sku', sa.String(length=120), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('color', sa.String(length=80), nullable=True),
        sa.Column('color_hex', sa.String(length=20), nullable=True),
        sa.Column('size', sa.String(length=40), nullable=True),
        sa.Column('model', sa.String(length=80), nullable=True),
        sa.Column('price', sa.Numeric(10, 2), nullable=False),
        sa.Column('promotional_price', sa.Numeric(10, 2), nullable=True),
        sa.Column('image_url', sa.String(length=1000), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=_timestamp_default()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=_timestamp_default()),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.CheckConstraint('price >= 0', name='ck_product_variants_price_nonnegative'),
        sa.CheckConstraint(
            'promotional_price IS NULL OR promotional_price <= price',
            name='ck_product_variants_promo_not_above_price',
        ),
        sa.UniqueConstraint('sku', name='uq_product_variants_sku'),
    )
    op.create_index('ix_product_variants_product_position', 'product_variants', ['product_id', 'position'])

    op.create_table(
        'inventory',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('variant_id', sa.Integer(), nullable=False),
        sa.Column('quantity_available', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('quantity_reserved', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=_timestamp_default()),
        sa.ForeignKeyConstraint(['variant_id'], ['product_variants.id'], ondelete='CASCADE'),
        sa.CheckConstraint('quantity_available >= 0', name='ck_inventory_available_nonnegative'),
        sa.CheckConstraint('quantity_reserved >= 0', name='ck_inventory_reserved_nonnegative'),
        sa.UniqueConstraint('variant_id', name='uq_inventory_variant_id'),
    )

    # Preserve the existing product-level stock as one explicit default
    # variant. This creates no new business data; it makes the legacy stock
    # representable by the complete catalog model.
    op.execute(sa.text('''
        INSERT INTO product_variants
            (product_id, sku, name, price, position, is_active)
        SELECT id, sku || '-DEFAULT', 'Padrão', COALESCE(base_price, price), 0, TRUE
        FROM products
    '''))
    op.execute(sa.text('''
        INSERT INTO inventory (variant_id, quantity_available, quantity_reserved)
        SELECT v.id, p.stock, 0
        FROM product_variants v
        JOIN products p ON p.id = v.product_id
        WHERE v.sku = p.sku || '-DEFAULT'
    '''))


def downgrade() -> None:
    op.drop_table('inventory')
    op.drop_index('ix_product_variants_product_position', table_name='product_variants')
    op.drop_table('product_variants')
    op.drop_index('ix_product_images_product_position', table_name='product_images')
    op.drop_table('product_images')
    op.drop_index('ix_product_categories_category_id', table_name='product_categories')
    op.drop_table('product_categories')

    op.drop_index('ix_products_catalog_status', table_name='products')
    op.drop_index('ux_products_sku', table_name='products')
    op.drop_index('ux_products_slug', table_name='products')
    for column in ('updated_at', 'created_at', 'is_featured', 'status', 'promotional_price', 'base_price', 'brand', 'short_description', 'sku', 'slug'):
        op.drop_column('products', column)

    op.drop_index('ix_categories_active_position', table_name='categories')
    if _is_sqlite():
        with op.batch_alter_table(
            'categories', recreate='always', copy_from=_categories_copy_from(with_parent_foreign_key=True)
        ) as batch:
            batch.drop_constraint('fk_categories_parent_id', type_='foreignkey')
    else:
        op.drop_constraint('fk_categories_parent_id', 'categories', type_='foreignkey')
    for column in ('updated_at', 'created_at', 'is_active', 'position', 'parent_id', 'image_url', 'description'):
        op.drop_column('categories', column)
