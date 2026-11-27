"""Provision only a verified disposable cluster; never used by test fixtures."""
from dataclasses import dataclass, field
import json
import os
import secrets
from uuid import uuid4

import psycopg
from psycopg import sql
try:
    from .docker_postgres_adapter import (DATABASE, USER, PORT, PGDATA, IDENTITY_SQL,
                                          DockerSafetyError, DockerPostgresAdapter)
except ImportError:
    from docker_postgres_adapter import (DATABASE, USER, PORT, PGDATA, IDENTITY_SQL,
                                         DockerSafetyError, DockerPostgresAdapter)

BOOTSTRAP = USER
MIGRATOR = 'focusstore_migrator'
APPLICATION = 'focusstore_test'
SCHEMA = 'public'


class RoleProvisioningBlocked(RuntimeError):
    """Sanitized authorization or provisioning failure."""
    def __init__(self, message='Verification failed.', *, code=None, stage=None, sqlstate=None, reason=None):
        super().__init__(message)
        self.code, self.stage, self.sqlstate, self.reason = code, stage, sqlstate, reason


@dataclass(frozen=True)
class RolePlan:
    migrator_password: str = field(default_factory=lambda: secrets.token_urlsafe(32), repr=False)
    application_password: str = field(default_factory=lambda: secrets.token_urlsafe(32), repr=False)
    database: str = DATABASE
    schema: str = SCHEMA
    execution_marker: str = field(default_factory=lambda: str(uuid4()))

    def __post_init__(self):
        if (self.database != DATABASE or self.schema != SCHEMA or not self.migrator_password
                or not self.application_password or self.migrator_password == self.application_password):
            raise ValueError('Invalid disposable role plan.')


def _check_identity(cursor, controller, connection, address):
    if cursor.connection is not connection:
        raise RoleProvisioningBlocked('Administrative connection changed.')
    cursor.execute(IDENTITY_SQL)
    ident = json.loads(cursor.fetchone()[0])
    if (ident['system_identifier'] != controller.cluster_id or ident['database'] != DATABASE
            or ident['user'] != BOOTSTRAP or ident['session_user'] != BOOTSTRAP
            or ident['port'] != 5432 or ident['data_directory'] != PGDATA
            or ident['address'].split('/')[0] != address
            or connection.info.hostaddr != '127.0.0.1' or connection.info.port != PORT):
        raise RoleProvisioningBlocked('Administrative connection identity mismatch.')


def _execute(cursor, template, *values):
    cursor.execute(sql.SQL(template).format(*(sql.Identifier(value) for value in values)))


def provision_roles(controller, authorization, plan=None):
    """Apply grants atomically; the validated connection is retained until commit."""
    plan = plan or RolePlan()
    stage, code = 'authorization', 'CLUSTER_IDENTITY_FAILED'
    try:
        if not isinstance(controller, DockerPostgresAdapter):
            raise RoleProvisioningBlocked('Invalid controller.')
        controller._require(authorization)
        if not controller.cluster_id or not controller.container_id or not controller.expected_image_id:
            raise RoleProvisioningBlocked('Verified cluster required.')
        if any(k.upper().startswith('PG') and v for k, v in os.environ.items()):
            raise RoleProvisioningBlocked('Conflicting PostgreSQL environment.')
        if len({controller.plan.bootstrap_password, plan.migrator_password, plan.application_password}) != 3:
            raise RoleProvisioningBlocked('Credentials must be distinct.')
        controller.cluster_identity(authorization)
        snapshot = (controller.plan.run_id, controller.plan.ownership_token, controller.container_id,
                    controller.expected_image_id, controller.cluster_id)
        details = controller._inspect('running')
        address = details['NetworkSettings']['Networks']['bridge']['IPAddress']
        stage, code = 'admin_connection', 'ADMIN_CONNECTION_FAILED'
        with psycopg.connect(host='127.0.0.1', hostaddr='127.0.0.1', port=PORT, dbname=DATABASE,
                             user=BOOTSTRAP, password=controller.plan.bootstrap_password, connect_timeout=3,
                             sslmode='disable', options='-c statement_timeout=5000 -c lock_timeout=2000') as connection:
            with connection.cursor() as cursor:
                stage, code = 'admin_identity', 'ADMIN_IDENTITY_MISMATCH'
                _check_identity(cursor, controller, connection, address)
                stage, code = 'hba_policy', 'HBA_POLICY_REJECTED'
                cursor.execute("SELECT count(*) = 0 FROM pg_hba_file_rules WHERE error IS NOT NULL OR (type IN ('host','hostssl','hostnossl','hostgssenc','hostnogssenc') AND auth_method <> 'scram-sha-256')")
                if cursor.fetchone()[0] is not True:
                    raise RoleProvisioningBlocked('SCRAM host authentication is not enforced.')
                cursor.execute("SET LOCAL password_encryption = 'scram-sha-256'")
                cursor.execute("SET LOCAL log_statement = 'none'")
                cursor.execute("SET LOCAL log_min_duration_statement = -1")
                cursor.execute("SET LOCAL log_min_error_statement = 'panic'")
                for name, password in ((MIGRATOR, plan.migrator_password), (APPLICATION, plan.application_password)):
                    stage, code = 'scram_verifier', 'SCRAM_VERIFIER_FAILED'
                    verifier = connection.pgconn.encrypt_password(password.encode(), name.encode(), b'scram-sha-256')
                    if not verifier.startswith(b'SCRAM-SHA-256$'):
                        raise RoleProvisioningBlocked('SCRAM verifier invalid.')
                    stage, code = 'role_creation', 'ROLE_CREATION_FAILED'
                    cursor.execute(sql.SQL('CREATE ROLE {} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT PASSWORD {}').format(
                        sql.Identifier(name), sql.Literal(verifier.decode('ascii'))))
                stage, code = 'grant_configuration', 'GRANT_CONFIGURATION_FAILED'
                cursor.execute("SELECT datname FROM pg_database WHERE datname NOT IN ('postgres','template0','template1',%s)", (DATABASE,))
                if cursor.fetchone() is not None:
                    raise RoleProvisioningBlocked('Unexpected database in cluster.')
                for db in (DATABASE, 'postgres', 'template0', 'template1'):
                    _execute(cursor, 'REVOKE CONNECT, CREATE, TEMPORARY ON DATABASE {} FROM PUBLIC', db)
                for role in (MIGRATOR, APPLICATION):
                    _execute(cursor, 'GRANT CONNECT ON DATABASE {} TO {}', DATABASE, role)
                _execute(cursor, 'ALTER SCHEMA {} OWNER TO {}', SCHEMA, MIGRATOR)
                _execute(cursor, 'REVOKE USAGE, CREATE ON SCHEMA {} FROM PUBLIC', SCHEMA)
                _execute(cursor, 'GRANT USAGE ON SCHEMA {} TO {}', SCHEMA, APPLICATION)
                _execute(cursor, 'REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA {} FROM PUBLIC', SCHEMA)
                _execute(cursor, 'ALTER DEFAULT PRIVILEGES FOR ROLE {} REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC', MIGRATOR)
                cursor.execute('CREATE SCHEMA focusstore_control AUTHORIZATION focusstore_bootstrap')
                cursor.execute('REVOKE USAGE, CREATE ON SCHEMA focusstore_control FROM PUBLIC')
                cursor.execute('CREATE TABLE focusstore_control.run_identity (marker text NOT NULL)')
                cursor.execute('INSERT INTO focusstore_control.run_identity (marker) VALUES (%s)', (plan.execution_marker,))
                cursor.execute('REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON focusstore_control.run_identity FROM PUBLIC')
                for role in (MIGRATOR, APPLICATION):
                    _execute(cursor, 'GRANT USAGE ON SCHEMA focusstore_control TO {}', role)
                    _execute(cursor, 'GRANT SELECT ON focusstore_control.run_identity TO {}', role)
                stage, code = 'effective_privileges', 'EFFECTIVE_PRIVILEGES_INVALID'
                cursor.execute("SELECT count(*) = 2 AND bool_and(rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls AND NOT rolinherit AND rolpassword LIKE 'SCRAM-SHA-256$%%') FROM pg_authid WHERE rolname IN (%s,%s)", (MIGRATOR, APPLICATION))
                if cursor.fetchone()[0] is not True:
                    raise RoleProvisioningBlocked('Role attributes or SCRAM invalid.')
                cursor.execute("SELECT has_database_privilege(%s,%s,'CONNECT') AND NOT has_database_privilege(%s,%s,'CREATE') AND NOT has_database_privilege(%s,%s,'TEMPORARY') AND has_schema_privilege(%s,'public','USAGE') AND NOT has_schema_privilege(%s,'public','CREATE') AND NOT EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname IN (%s,%s)) AND NOT EXISTS (SELECT 1 FROM pg_database d WHERE d.datname <> %s AND has_database_privilege(%s,d.oid,'CONNECT'))", (APPLICATION,DATABASE,APPLICATION,DATABASE,APPLICATION,DATABASE,APPLICATION,APPLICATION,MIGRATOR,APPLICATION,DATABASE,APPLICATION))
                if cursor.fetchone()[0] is not True:
                    raise RoleProvisioningBlocked('Effective privileges invalid.')
                stage, code = 'admin_identity', 'ADMIN_IDENTITY_MISMATCH'
                _check_identity(cursor, controller, connection, address)
                controller._inspect('running')
                if snapshot != (controller.plan.run_id, controller.plan.ownership_token, controller.container_id,
                                controller.expected_image_id, controller.cluster_id):
                    raise RoleProvisioningBlocked('Controller identity changed.')
            stage, code = 'commit', 'TRANSACTION_COMMIT_FAILED'
        return plan
    except Exception as error:
        state = getattr(error, 'sqlstate', None)
        if not isinstance(state, str) or len(state) != 5 or not state.isalnum():
            state = None
        raise RoleProvisioningBlocked('Role provisioning failed; resource preserved.', code=code, stage=stage, sqlstate=state) from None
