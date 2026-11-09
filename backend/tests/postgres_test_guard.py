"""Safety gates for disposable PostgreSQL integration-test databases."""

import re

from sqlalchemy import text
from sqlalchemy.engine import Connection, URL, make_url


PROTECTED_DATABASE = 'focusstore_test'
PROTECTED_PORT = 5432
LOCAL_HOSTS = {'127.0.0.1', 'localhost', '::1'}
DISPOSABLE_DATABASE = re.compile(r'^focusstore_(?:itest|integration_test|ci)$')


def safe_test_url(raw: str) -> URL:
    url = make_url(raw)
    if url.get_backend_name() != 'postgresql':
        raise AssertionError('TEST_DATABASE_URL must use PostgreSQL')
    if url.host not in LOCAL_HOSTS:
        raise AssertionError('TEST_DATABASE_URL must target loopback')
    if url.port in {None, PROTECTED_PORT}:
        raise AssertionError('TEST_DATABASE_URL must use an explicit non-protected port')
    if not url.database or url.database.lower() == PROTECTED_DATABASE:
        raise AssertionError('TEST_DATABASE_URL targets the protected database')
    if not DISPOSABLE_DATABASE.fullmatch(url.database.lower()):
        raise AssertionError('TEST_DATABASE_URL must target a named disposable database')
    if not url.username or url.username == 'postgres':
        raise AssertionError('TEST_DATABASE_URL must use a dedicated test role')
    return url


def validate_identity(connection: Connection, url: URL) -> None:
    identity = connection.execute(text(
        'SELECT current_database(), current_user, inet_server_addr()::text, '
        'inet_server_port(), current_schema()'
    )).one()
    address = identity[2].split('/')[0] if identity[2] else None
    if identity[0] != url.database:
        raise AssertionError('effective database differs from TEST_DATABASE_URL')
    if identity[1] != url.username:
        raise AssertionError('effective user differs from TEST_DATABASE_URL')
    if address not in {'127.0.0.1', '::1'}:
        raise AssertionError('effective PostgreSQL address is not loopback')
    if identity[3] != url.port or identity[3] == PROTECTED_PORT:
        raise AssertionError('effective PostgreSQL port is protected or unexpected')
    if identity[4] != 'public':
        raise AssertionError('identity validation must run in public schema')
