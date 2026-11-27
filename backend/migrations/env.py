from logging.config import fileConfig
import os

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlalchemy.engine import make_url

from app.config import get_settings
from app.db.base import Base
from app import models  # noqa: F401 -- register metadata before migrations

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

provided = config.attributes.get('connection')
authorization = config.attributes.get('disposable_authorization')
if provided is None and authorization is None:
    settings = get_settings()
    config.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    if provided is not None or authorization is not None:
        raise RuntimeError('Disposable migrations require an authorized online connection.')
    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    if provided is not None or authorization is not None:
        from scripts.alembic_authorization import MigrationAuthorization, MigrationAuthorizationError
        from scripts import alembic_authorization as disposable_guard
        if not isinstance(authorization, MigrationAuthorization) or provided is None:
            raise MigrationAuthorizationError('Disposable migration authorization is required.')
        if authorization.profile == 'commercial':
            if not disposable_guard.OPERATIONAL_EXECUTION_ENABLED:
                raise MigrationAuthorizationError('Disposable migration execution remains blocked.')
        elif authorization.profile in {'synthetic_commit', 'synthetic_rollback'}:
            from pathlib import Path
            root = Path(__file__).resolve().parents[1] / 'synthetic_alembic'
            expected = root / ('commit' if authorization.profile == 'synthetic_commit' else 'rollback')
            if (not disposable_guard.SYNTHETIC_EXECUTION_ENABLED
                    or Path(config.get_main_option('script_location')).resolve() != expected.resolve()):
                raise MigrationAuthorizationError('Synthetic migration execution remains blocked.')
        else:
            raise MigrationAuthorizationError('Migration profile invalid.')
        disposable_guard.verify_alembic_upgrade(context._proxy)
        authorization.validate(provided, 'upgrade:head')
        try:
            context.configure(connection=provided, target_metadata=target_metadata)
            with context.begin_transaction():
                context.run_migrations()
        except Exception as error:
            from scripts.synthetic_alembic_signal import ExpectedSyntheticRollback
            if authorization.profile == 'synthetic_rollback' and type(error) is ExpectedSyntheticRollback:
                raise MigrationAuthorizationError('Synthetic rollback requested.', code='SYNTHETIC_EXPECTED_ROLLBACK') from None
            raise MigrationAuthorizationError('Disposable migration failed; caller must roll back.', code='MIGRATION_FAILED') from None
        return
    url = make_url(config.get_main_option('sqlalchemy.url'))
    from scripts.alembic_authorization import guard_legacy_test_target
    guard_legacy_test_target(url, os.environ)
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
