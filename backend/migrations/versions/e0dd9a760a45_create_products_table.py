"""create products table

Revision ID: e0dd9a760a45
Revises: b24f91c73a60
Create Date: 2026-10-26 17:14:09.755757

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e0dd9a760a45'
down_revision: Union[str, Sequence[str], None] = 'b24f91c73a60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("stock", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),

        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
        ),

        sa.CheckConstraint(
            "price > 0",
            name="ck_products_price_positive",
        ),

        sa.CheckConstraint(
            "stock >= 0",
            name="ck_products_stock_nonnegative",
        ),
    )


def downgrade() -> None:
    op.drop_table("products")