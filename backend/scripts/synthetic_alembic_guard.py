"""Fail closed before a synthetic Alembic environment can enter legacy paths."""
from pathlib import Path
from runpy import run_path

from alembic import context
from scripts import alembic_authorization as guard


def enter(profile):
    root = Path(__file__).resolve().parents[1]
    allowed = {'synthetic_commit': root / 'synthetic_alembic' / 'commit',
               'synthetic_rollback': root / 'synthetic_alembic' / 'rollback'}
    try:
        config = context.config
        authorization = config.attributes.get('disposable_authorization')
        connection = config.attributes.get('connection')
        if (profile not in allowed or context.is_offline_mode() or not guard.SYNTHETIC_EXECUTION_ENABLED
                or not isinstance(authorization, guard.MigrationAuthorization)
                or authorization.profile != profile or authorization.operation != 'upgrade:head'
                or connection is None or authorization.connection is not connection
                or Path(config.get_main_option('script_location')).resolve() != allowed[profile].resolve()):
            raise ValueError()
    except Exception:
        raise guard.MigrationAuthorizationError('Synthetic migration authorization required.', code='AUTHORIZATION_INVALID') from None
    run_path(str(root / 'migrations' / 'env.py'))
