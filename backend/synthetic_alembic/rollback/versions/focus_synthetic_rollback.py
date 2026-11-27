"""Fixed, noncommercial rollback rehearsal."""
from alembic import op
from scripts.synthetic_alembic_signal import ExpectedSyntheticRollback

revision = 'focus_synthetic_rollback'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute('CREATE TABLE focusstore_alembic_synthetic (id integer PRIMARY KEY, value text NOT NULL)')
    op.execute("INSERT INTO focusstore_alembic_synthetic (id, value) VALUES (1, 'synthetic')")
    raise ExpectedSyntheticRollback()


def downgrade():
    raise RuntimeError('Downgrade is not authorized.')
