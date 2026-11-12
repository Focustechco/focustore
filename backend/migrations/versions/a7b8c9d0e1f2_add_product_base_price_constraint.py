"""Add the Product base price nonnegative constraint."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = "f4a1d2e3c4b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _products_copy_from() -> sa.Table:
    metadata = sa.MetaData()
    return sa.Table(
        "products",
        metadata,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("stock", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(length=180), nullable=True),
        sa.Column("sku", sa.String(length=120), nullable=True),
        sa.Column("short_description", sa.Text(), nullable=True),
        sa.Column("brand", sa.String(length=120), nullable=False, server_default="Focus"),
        sa.Column("base_price", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("promotional_price", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="ACTIVE"),
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.CheckConstraint("price > 0", name="ck_products_price_positive"),
        sa.CheckConstraint("stock >= 0", name="ck_products_stock_nonnegative"),
        sa.CheckConstraint(
            "base_price IS NULL OR base_price >= 0",
            name="ck_products_base_price_nonnegative",
        ),
        sa.Index("ux_products_slug", "slug", unique=True),
        sa.Index("ux_products_sku", "sku", unique=True),
        sa.Index("ix_products_catalog_status", "status", "slug"),
    )


def upgrade() -> None:
    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("products", recreate="always", copy_from=_products_copy_from()) as batch:
            batch.create_check_constraint(
                "ck_products_base_price_nonnegative",
                "base_price IS NULL OR base_price >= 0",
            )
    else:
        op.create_check_constraint(
            "ck_products_base_price_nonnegative",
            "products",
            "base_price IS NULL OR base_price >= 0",
        )


def downgrade() -> None:
    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("products", recreate="always", copy_from=_products_copy_from()) as batch:
            batch.drop_constraint("ck_products_base_price_nonnegative", type_="check")
    else:
        op.drop_constraint(
            "ck_products_base_price_nonnegative",
            "products",
            type_="check",
        )
