from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.db.base import Base
from app import models  # noqa: F401 -- register metadata before migrations

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _configure_url_from_settings() -> None:
    """Use the application URL only for ordinary Alembic CLI invocations.

    Local validation supplies an already-validated SQLAlchemy connection through
    ``config.attributes``. In that mode this function is intentionally skipped,
    so a developer ``.env`` (which may point to Supabase) cannot replace the
    explicitly approved local connection.
    """
    from app.config import get_settings

    settings = get_settings()
    config.set_main_option(
        "sqlalchemy.url",
        settings.database_url.replace("%", "%%"),
    )


def run_migrations_offline() -> None:
    _configure_url_from_settings()
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
    supplied_connection = config.attributes.get("connection")
    if supplied_connection is not None:
        context.configure(
            connection=supplied_connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()
        return

    _configure_url_from_settings()
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
