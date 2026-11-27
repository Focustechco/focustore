"""Connection-bound disposable migration capability; no database is opened here."""
from dataclasses import dataclass, field
from uuid import UUID
from types import CodeType
import sys
from alembic import command
from psycopg.pq import TransactionStatus

from sqlalchemy import text
from sqlalchemy.engine import Connection
from scripts.docker_postgres_adapter import DockerPostgresAdapter, _SMOKE_AUTHORIZATION, DATABASE, PORT

# Safety interlock only, never an authorization; enabling needs a reviewed change.
OPERATIONAL_EXECUTION_ENABLED = False
SYNTHETIC_EXECUTION_ENABLED = True


class MigrationAuthorizationError(RuntimeError):
    """Sanitized failure of disposable migration authorization."""
    def __init__(self, message, code='AUTHORIZATION_INVALID'):
        super().__init__(message)
        self.code = code


def controller_token(controller):
    """Accept the existing script and package import identities without creating aliases."""
    if isinstance(controller, DockerPostgresAdapter):
        token = _SMOKE_AUTHORIZATION
    else:
        standalone = sys.modules.get('docker_postgres_adapter')
        if standalone is None or not isinstance(controller, standalone.DockerPostgresAdapter):
            raise MigrationAuthorizationError('Controller is invalid.')
        token = standalone._SMOKE_AUTHORIZATION
    controller._require(token)
    return token


def verify_alembic_upgrade(context_proxy):
    """Constrain Alembic's internal callback to the installed command.upgrade implementation."""
    try:
        options = context_proxy.context_opts
        if not isinstance(options, dict) or options.get('destination_rev') != 'head' or options.get('as_sql'):
            raise ValueError()
        callback = options['fn']
        expected = [item for item in command.upgrade.__code__.co_consts if isinstance(item, CodeType) and item.co_name == 'upgrade']
        if len(expected) != 1 or getattr(callback, '__code__', None) is not expected[0]:
            raise ValueError()
    except Exception:
        raise MigrationAuthorizationError('Alembic operation is not authorized.', code='OPERATION_NOT_AUTHORIZED') from None


def guard_legacy_test_target(url, environment):
    if url.get_backend_name() != 'postgresql':
        return
    query_keys = {'host', 'hostaddr', 'port', 'service', 'options', 'dbname', 'database', 'user', 'password'}
    host = url.host or ''
    if (not host or any(ch in host for ch in ',/\\') or any(k.lower() in query_keys for k in url.query)
            or any(k.upper().startswith('PG') and v for k, v in environment.items())
            or url.port == 55432 or (url.database or '').lower().endswith('_test')
            or environment.get('FOCUS_TEST_POSTGRES_PROFILE') or environment.get('TEST_DATABASE_URL')):
        raise MigrationAuthorizationError('PostgreSQL test or ambiguous destination requires authorization.', code='CONNECTION_INVALID')


@dataclass(frozen=True, repr=False)
class MigrationAuthorization:
    controller: DockerPostgresAdapter
    connection: Connection
    marker: str
    operation: str
    profile: str = 'commercial'
    _snapshot: tuple = field(init=False, repr=False)
    _transaction: object = field(init=False, repr=False)
    _driver: object = field(init=False, repr=False)
    _token: object = field(init=False, repr=False)
    _state: list = field(default_factory=lambda: ['issued'], init=False, repr=False, compare=False)
    _transaction_id: list = field(default_factory=list, init=False, repr=False, compare=False)

    def __post_init__(self):
        try:
            if not isinstance(self.connection, Connection):
                raise ValueError()
            object.__setattr__(self, '_token', controller_token(self.controller))
            if self.operation != 'upgrade:head' or self.profile not in {'commercial', 'synthetic_commit', 'synthetic_rollback'} or str(UUID(self.marker)) != self.marker:
                raise ValueError()
            if (self.connection.closed or self.connection.invalidated or not self.connection.in_transaction()
                    or self.connection.get_nested_transaction() is not None):
                raise ValueError()
            transaction = self.connection.get_transaction()
            driver = self.connection.connection.driver_connection
            if (not transaction or not transaction.is_active or driver.closed or driver.broken
                    or driver.info.transaction_status not in {TransactionStatus.IDLE, TransactionStatus.INTRANS}):
                raise ValueError()
            object.__setattr__(self, '_transaction', transaction)
            object.__setattr__(self, '_driver', driver)
            c = self.controller
            if not c.container_id or not c.expected_image_id or not c.cluster_id:
                raise ValueError()
            object.__setattr__(self, '_snapshot', (c.plan.run_id, c.plan.ownership_token, c.container_id, c.expected_image_id, c.cluster_id))
        except Exception:
            raise MigrationAuthorizationError('Disposable migration authorization is invalid.') from None

    def _verify(self, connection, operation, *, first):
        try:
            c = self.controller
            if (connection is not self.connection or connection.closed or connection.invalidated
                    or connection.connection.driver_connection is not self._driver or self._driver.closed or self._driver.broken):
                raise MigrationAuthorizationError('Connection binding invalid.', code='CONNECTION_INVALID')
            if (not connection.in_transaction() or connection.get_nested_transaction() is not None
                    or not self._transaction.is_active or connection.get_transaction() is not self._transaction):
                raise MigrationAuthorizationError('External transaction invalid.', code='TRANSACTION_INVALID')
            permitted = {TransactionStatus.IDLE, TransactionStatus.INTRANS} if first else {TransactionStatus.INTRANS}
            if self._driver.info.transaction_status not in permitted:
                raise MigrationAuthorizationError('Physical transaction invalid.', code='TRANSACTION_INVALID')
            if operation != self.operation:
                raise MigrationAuthorizationError('Operation not authorized.', code='OPERATION_NOT_AUTHORIZED')
            if self._snapshot != (c.plan.run_id, c.plan.ownership_token, c.container_id, c.expected_image_id, c.cluster_id):
                raise MigrationAuthorizationError('Identity invalid.', code='IDENTITY_FAILED')
            url = connection.engine.url
            if (url.drivername != 'postgresql+psycopg' or url.host != '127.0.0.1' or url.port != PORT
                    or url.database != DATABASE or url.username != 'focusstore_migrator' or url.query
                    or self._driver.info.hostaddr != '127.0.0.1' or self._driver.info.port != PORT):
                raise ValueError()
            c.cluster_identity(self._token)
            details = c._inspect('running')
            address = details['NetworkSettings']['Networks']['bridge']['IPAddress']
            row = connection.execute(text('SELECT current_database(), current_user, session_user, inet_server_addr()::text, inet_server_port()')).one()
            if (row[0], row[1], row[2], row[3].split('/')[0], row[4]) != (DATABASE, 'focusstore_migrator', 'focusstore_migrator', address, 5432):
                raise ValueError()
            marker = connection.execute(text('SELECT marker FROM focusstore_control.run_identity')).scalar_one()
            if marker != self.marker:
                raise ValueError()
            xid = connection.execute(text('SELECT pg_current_xact_id()::text')).scalar_one()
            if not isinstance(xid, str) or not xid.isascii() or not xid.isdigit() or self._driver.info.transaction_status != TransactionStatus.INTRANS:
                raise MigrationAuthorizationError('Physical transaction invalid.', code='TRANSACTION_INVALID')
            if first:
                self._transaction_id.append(xid)
            elif self._transaction_id != [xid]:
                raise MigrationAuthorizationError('Physical transaction changed.', code='TRANSACTION_INVALID')
            # Confirm the same marker independently in the already validated container.
            script = ('set -eu; IFS= read -r PGPASSWORD; export PGPASSWORD; '
                      'exec psql -X -q -t -A -h 127.0.0.1 -p 5432 -U focusstore_bootstrap '
                      '-d focusstore_integration_test -c "SELECT marker FROM focusstore_control.run_identity"')
            value = c._command(['exec', '-i', '--user', 'postgres', c.container_id, '/bin/sh', '-c', script],
                               input_data=(c.plan.bootstrap_password + '\n').encode(), timeout=10).decode('ascii').strip()
            if (value != self.marker or connection.closed or connection.invalidated or not self._transaction.is_active
                    or connection.get_transaction() is not self._transaction or connection.get_nested_transaction() is not None
                    or connection.connection.driver_connection is not self._driver or self._driver.closed or self._driver.broken
                    or self._driver.info.transaction_status != TransactionStatus.INTRANS
                    or self._snapshot != (c.plan.run_id, c.plan.ownership_token, c.container_id, c.expected_image_id, c.cluster_id)):
                raise ValueError()
        except MigrationAuthorizationError:
            raise
        except Exception:
            raise MigrationAuthorizationError('Disposable migration verification failed.', code='IDENTITY_FAILED') from None

    def validate(self, connection, operation):
        if self._state[0] != 'issued':
            raise MigrationAuthorizationError('Authorization already consumed.')
        self._state[0] = 'consumed'
        try:
            self._verify(connection, operation, first=True)
        except Exception:
            self._state[0] = 'failed'
            raise

    def revalidate(self, connection):
        if self._state[0] != 'consumed':
            raise MigrationAuthorizationError('Authorization cannot be revalidated.', code='REVALIDATION_FAILED')
        try:
            self._verify(connection, self.operation, first=False)
        except MigrationAuthorizationError:
            self._state[0] = 'failed'
            raise MigrationAuthorizationError('Post-migration verification failed.', code='REVALIDATION_FAILED') from None
        self._state[0] = 'revalidated'

    def close(self):
        self._state[0] = 'closed'
