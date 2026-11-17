"""Manage only a fresh, run-owned PostgreSQL database for catalog E2E."""
import os
import re
import sys

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


def validated_url(raw: str):
    url = make_url(raw)
    if (url.drivername != 'postgresql+psycopg' or url.host not in {'localhost', '127.0.0.1'}
            or not url.port or not url.username or not url.database
            or not url.database.endswith('_test') or url.query):
        raise ValueError('E2E requires an explicit loopback PostgreSQL test URL without query options')
    return url


def owned_name(run_id: str) -> str:
    if not re.fullmatch(r'[a-f0-9]{32}', run_id):
        raise ValueError('A valid E2E run identity is required')
    return f'focusstore_e2e_{run_id}_test'


def validate_owned_url(raw: str, run_id: str):
    url = validated_url(raw)
    if url.database != owned_name(run_id):
        raise ValueError('Seed destination does not belong to this E2E run')
    return url


def manage(action: str) -> None:
    base = validated_url(os.environ['FOCUS_E2E_DATABASE_URL'])
    name = owned_name(os.environ['FOCUS_E2E_RUN_ID'])
    engine = create_engine(base, isolation_level='AUTOCOMMIT', hide_parameters=True,
                           connect_args={'connect_timeout': 5})
    try:
        with engine.connect() as connection:
            # Strict hexadecimal run identity makes the quoted identifier safe.
            if action == 'create':
                connection.execute(text(f'CREATE DATABASE "{name}"'))
            elif action == 'drop':
                connection.execute(text(f'DROP DATABASE "{name}" WITH (FORCE)'))
            else:
                raise ValueError('Unknown E2E database operation')
    finally:
        engine.dispose()
    print(f'E2E database {action}: {name}')


if __name__ == '__main__':
    try:
        manage(sys.argv[1])
    except Exception as exc:
        # Database exceptions can include URLs and credentials.
        print(f'E2E database operation failed ({type(exc).__name__})', file=sys.stderr)
        raise SystemExit(1)
