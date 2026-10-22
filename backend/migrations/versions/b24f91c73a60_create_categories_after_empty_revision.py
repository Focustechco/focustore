"""Create categories after the original empty revision.

Revision ID: b24f91c73a60
Revises: 7ec8ee7c05e5
"""
from alembic import op
import sqlalchemy as sa

revision = "b24f91c73a60"
down_revision = "7ec8ee7c05e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=140), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )


def downgrade() -> None:
    op.drop_table("categories")
