"""Fail-closed checks for PostgreSQL test configuration.

URL validation cannot establish that a server is disposable. PostgreSQL test
operations remain disabled until a separate server-identity check is designed.
"""

from collections.abc import Mapping

from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import ArgumentError


class PostgresTestGuardError(RuntimeError):
    """The test target is unsafe or has not been authorized."""


def validate_test_url(raw: str | None, env: Mapping[str, str], *, inherited_database_url: str | None = None) -> URL:
    """Validate configuration only, without connecting or authorizing operations."""
    profile = env.get('FOCUS_TEST_POSTGRES_PROFILE')
    if env.get('FOCUS_TEST_POSTGRES_AUTHORIZE') != '1' or profile not in {'local', 'ci'}:
        raise PostgresTestGuardError('PostgreSQL test configuration requires explicit authorization and profile.')

    if any(key.upper().startswith('PG') and value for key, value in env.items()):
        raise PostgresTestGuardError('Conflicting PostgreSQL environment configuration.')

    if profile == 'local':
        if env.get('CI') or env.get('GITHUB_ACTIONS'):
            raise PostgresTestGuardError('Conflicting PostgreSQL test profile.')
        expected = ('127.0.0.1', 55432, 'focusstore_integration_test', 'focusstore_test')
    else:
        if env.get('CI') != 'true' or env.get('GITHUB_ACTIONS') != 'true':
            raise PostgresTestGuardError('CI PostgreSQL test profile is unavailable.')
        expected = ('localhost', 5432, 'focusstore_test', 'focusstore')

    try:
        if not raw or not isinstance(raw, str):
            raise ValueError('missing URL')
        url = make_url(raw)
        if (url.drivername != 'postgresql+psycopg' or not url.password or url.query
                or (url.host, url.port, url.database, url.username) != expected):
            raise ValueError('invalid URL')
        if inherited_database_url and make_url(inherited_database_url) != url:
            raise ValueError('conflicting database')
    except (ArgumentError, ValueError, TypeError):
        raise PostgresTestGuardError('Invalid or conflicting PostgreSQL test configuration.') from None
    return url


def authorize_test_target(raw: str | None, env: Mapping[str, str], *, inherited_database_url: str | None = None) -> URL:
    validate_test_url(raw, env, inherited_database_url=inherited_database_url)
    raise PostgresTestGuardError('PostgreSQL test operations are blocked until disposable server identity is verified.')
