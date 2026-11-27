"""Fixed, noncommercial commit rehearsal."""
from alembic import op

revision = 'focus_synthetic_commit'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute('CREATE TABLE focusstore_alembic_synthetic (id integer PRIMARY KEY, value text NOT NULL)')
    op.execute("INSERT INTO focusstore_alembic_synthetic (id, value) VALUES (1, 'synthetic')")


def downgrade():
    raise RuntimeError('Downgrade is not authorized.')
