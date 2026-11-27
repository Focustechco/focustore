"""Opt-in smoke test against one verified disposable PostgreSQL instance."""
import argparse
import json
import re
import secrets
import psycopg
from scram_negative_probe import probe, ProbeError

from docker_postgres_adapter import DockerPostgresAdapter, DockerSafetyError, _SMOKE_AUTHORIZATION, DATABASE, PORT
from role_provisioning import provision_roles, MIGRATOR, APPLICATION, RoleProvisioningBlocked


def _connect(user, password):
    return psycopg.connect(host='127.0.0.1', hostaddr='127.0.0.1', port=PORT, dbname=DATABASE,
                           user=user, password=password, connect_timeout=3, sslmode='disable',
                           autocommit=True, options='-c statement_timeout=5000 -c lock_timeout=2000')


def _identity(cursor, user, address, marker):
    cursor.execute('SELECT current_database(), current_user, session_user, inet_server_addr()::text, inet_server_port()')
    db, current, session, host, port = cursor.fetchone()
    if (db, current, session, host.split('/')[0], port) != (DATABASE, user, user, address, 5432):
        raise RoleProvisioningBlocked('Role connection identity mismatch.', code='ROLE_IDENTITY_MISMATCH', stage='role_identity')
    cursor.execute('SELECT marker FROM focusstore_control.run_identity')
    if cursor.fetchone() != (marker,):
        raise RoleProvisioningBlocked('Role execution identity mismatch.', code='ROLE_IDENTITY_MISMATCH', stage='role_identity')


def _wrong_password(error):
    state = getattr(error, 'sqlstate', None)
    if state == '28P01':
        return 'rejected'
    if state == '3D000':
        return 'database_missing'
    if state in {'08001', '08004', '08006'}:
        return 'connection_failed'
    if isinstance(error, TimeoutError):
        return 'timeout'
    return 'indeterminate'


def _correct_connection(controller, authorization, role, password, marker):
    try:
        controller.cluster_identity(authorization)
        details = controller._inspect('running')
        address = details['NetworkSettings']['Networks']['bridge']['IPAddress']
        with _connect(role, password) as connection:
            with connection.cursor() as cursor:
                _identity(cursor, role, address, marker)
    except Exception as error:
        code = 'ROLE_IDENTITY_MISMATCH' if isinstance(error, RoleProvisioningBlocked) else 'ROLE_CONNECTION_FAILED'
        raise RoleProvisioningBlocked('Correct credential verification failed.', code=code, stage='role_identity', reason='identity_failed' if code == 'ROLE_IDENTITY_MISMATCH' else 'connection_failed') from None


def _verify_wrong_password(controller, authorization, role, password, marker):
    _correct_connection(controller, authorization, role, password, marker)
    result, state = 'incorrect_password_accepted', None
    authentication_hint = False
    try:
        with _connect(role, 'deliberately-invalid-' + secrets.token_urlsafe(24)):
            pass
    except psycopg.Error as error:
        result, state = _wrong_password(error), error.sqlstate
        message = str(error)
        authentication_hint = (len(message) <= 4096 and bool(re.search(
            r'(?m)(?:^|\s)FATAL:\s+password authentication failed for user "' + re.escape(role) + r'"\s*$', message)))
    except TimeoutError:
        result = 'timeout'
    evidence = 'sqlstate_28p01'
    if result == 'indeterminate' and authentication_hint:
        try:
            result = probe(controller, authorization, role)
            evidence = 'invalid_scram_proof_sqlstate_28p01'
        except ProbeError as error:
            result = error.reason
    _correct_connection(controller, authorization, role, password, marker)
    if result != 'rejected':
        raise RoleProvisioningBlocked('Authentication rejection not proven.', code='WRONG_PASSWORD_CHECK_FAILED', stage='wrong_password', sqlstate=state, reason=result)
    return evidence


def _denied(cursor, statement):
    try:
        cursor.execute(statement)
    except psycopg.Error as error:
        if error.sqlstate == '42501':
            return
        raise RoleProvisioningBlocked('Negative check failed unexpectedly.', code='APPLICATION_DML_FAILED', stage='negative_checks', sqlstate=error.sqlstate) from None
    raise RoleProvisioningBlocked('Expected permission denial not observed.', code='EXPECTED_PERMISSION_DENIAL_MISSING', stage='negative_checks')


def verify_roles(controller, authorization, plan):
    try:
        return _verify_roles(controller, authorization, plan)
    except RoleProvisioningBlocked:
        raise
    except Exception as error:
        state = getattr(error, 'sqlstate', None)
        if not isinstance(state, str) or len(state) != 5 or not state.isalnum():
            state = None
        code = {'synthetic_ddl': 'SYNTHETIC_DDL_FAILED', 'application_dml': 'APPLICATION_DML_FAILED'}.get(controller.stage, 'ROLE_CONNECTION_FAILED')
        raise RoleProvisioningBlocked('Role verification failed.', code=code, stage=controller.stage, sqlstate=state) from None


def _verify_roles(controller, authorization, plan):
    try:
        controller.cluster_identity(authorization)
    except Exception:
        raise RoleProvisioningBlocked('Cluster identity failed.', code='CLUSTER_IDENTITY_FAILED', stage='cluster_identity') from None
    details = controller._inspect('running')
    address = details['NetworkSettings']['Networks']['bridge']['IPAddress']
    evidence = {}
    for user, password in ((MIGRATOR, plan.migrator_password), (APPLICATION, plan.application_password)):
        evidence[user] = _verify_wrong_password(controller, authorization, user, password, plan.execution_marker)
    with _connect(MIGRATOR, plan.migrator_password) as connection:
        with connection.cursor() as cursor:
            _identity(cursor, MIGRATOR, address, plan.execution_marker)
            controller.stage = 'synthetic_ddl'
            cursor.execute('CREATE TABLE public.focusstore_role_smoke (id bigint PRIMARY KEY, value integer NOT NULL)')
            cursor.execute('CREATE TABLE public.focusstore_role_private (id integer)')
            cursor.execute('CREATE TABLE public.focusstore_role_control (id integer)')
            cursor.execute('CREATE SEQUENCE public.focusstore_role_allowed_seq')
            cursor.execute('CREATE SEQUENCE public.focusstore_role_private_seq')
            cursor.execute("CREATE FUNCTION public.focusstore_role_smoke_fn() RETURNS integer LANGUAGE SQL AS 'SELECT 1'")
            cursor.execute('GRANT SELECT, INSERT, UPDATE, DELETE ON public.focusstore_role_smoke TO focusstore_test')
            cursor.execute('GRANT USAGE ON SEQUENCE public.focusstore_role_allowed_seq TO focusstore_test')
    controller.stage = 'role_connection'
    with _connect(APPLICATION, plan.application_password) as connection:
        with connection.cursor() as cursor:
            _identity(cursor, APPLICATION, address, plan.execution_marker)
            controller.stage = 'application_dml'
            cursor.execute("SELECT nextval('public.focusstore_role_allowed_seq')")
            item = cursor.fetchone()[0]
            cursor.execute('INSERT INTO public.focusstore_role_smoke (id, value) VALUES (%s, 1) RETURNING id', (item,))
            item = cursor.fetchone()[0]
            cursor.execute('SELECT value FROM public.focusstore_role_smoke WHERE id = %s', (item,))
            if cursor.fetchone()[0] != 1:
                raise RoleProvisioningBlocked('Read check failed.')
            cursor.execute('UPDATE public.focusstore_role_smoke SET value = 2 WHERE id = %s RETURNING value', (item,))
            if cursor.fetchone()[0] != 2:
                raise RoleProvisioningBlocked('Update check failed.')
            cursor.execute('DELETE FROM public.focusstore_role_smoke WHERE id = %s RETURNING id', (item,))
            if cursor.fetchone()[0] != item:
                raise RoleProvisioningBlocked('Delete check failed.')
            for statement in ('TRUNCATE public.focusstore_role_smoke',
                              'CREATE TABLE public.focusstore_role_forbidden (id integer)',
                              'CREATE TEMP TABLE focusstore_role_forbidden (id integer)',
                              'SET ROLE focusstore_migrator', 'SELECT public.focusstore_role_smoke_fn()',
                              'SELECT * FROM public.focusstore_role_private',
                              'SELECT * FROM public.focusstore_role_control',
                              'INSERT INTO public.focusstore_role_control VALUES (1)',
                              'UPDATE public.focusstore_role_control SET id = 1',
                              'DELETE FROM public.focusstore_role_control',
                              'TRUNCATE public.focusstore_role_control',
                              "SELECT nextval('public.focusstore_role_private_seq')",
                              "UPDATE focusstore_control.run_identity SET marker = 'forged'"):
                _denied(cursor, statement)
            _identity(cursor, APPLICATION, address, plan.execution_marker)
    try:
        controller.cluster_identity(authorization)
    except Exception:
        raise RoleProvisioningBlocked('Cluster identity failed.', code='CLUSTER_IDENTITY_FAILED', stage='cluster_identity') from None
    return evidence


def run_smoke(controller):
    auth = _SMOKE_AUTHORIZATION
    def step(stage, code, operation):
        controller.stage = stage
        try:
            return operation()
        except Exception as error:
            if isinstance(error, RoleProvisioningBlocked) and error.code:
                raise
            if stage == 'preflight' and isinstance(error, DockerSafetyError) and error.code in {
                    'PORT_UNAVAILABLE', 'DOCKER_CONTEXT_MISMATCH', 'DOCKER_ENDPOINT_MISMATCH',
                    'DOCKER_ENV_CONFLICT', 'DOCKER_UNAVAILABLE', 'IMAGE_VALIDATION_FAILED'}:
                raise RoleProvisioningBlocked('Preflight failed.', code=error.code, stage=stage) from None
            state = getattr(error, 'sqlstate', None)
            if not isinstance(state, str) or len(state) != 5 or not state.isalnum():
                state = None
            raise RoleProvisioningBlocked('Smoke verification failed.', stage=stage, code=code, sqlstate=state) from None
    step('preflight', 'CONTAINER_PREFLIGHT_FAILED', lambda: controller.preflight(auth))
    step('create', 'CONTAINER_PREFLIGHT_FAILED', lambda: controller.create(auth))
    step('start', 'CONTAINER_PREFLIGHT_FAILED', lambda: controller.start(auth))
    step('readiness', 'CLUSTER_IDENTITY_FAILED', lambda: controller.wait_ready(auth))
    step('cluster_identity', 'CLUSTER_IDENTITY_FAILED', lambda: controller.cluster_identity(auth))
    plan = step('provision', 'ROLE_CREATION_FAILED', lambda: provision_roles(controller, auth))
    evidence = step('role_verification', 'ROLE_CONNECTION_FAILED', lambda: verify_roles(controller, auth, plan))
    step('cleanup', 'CLEANUP_FAILED', lambda: controller.remove_bootstrap_file(auth))
    step('cleanup', 'CLEANUP_FAILED', lambda: controller.stop_and_remove(auth))
    return {'status': 'passed', 'container_removed': True, 'authentication_evidence': evidence}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--confirm-disposable', action='store_true')
    args = parser.parse_args(argv)
    if args.execute != args.confirm_disposable:
        print(json.dumps({'status': 'rejected'}))
        return 2
    if not args.execute:
        print(json.dumps({'status': 'plan', 'database': DATABASE, 'roles': [MIGRATOR, APPLICATION]}))
        return 0
    controller = DockerPostgresAdapter()
    try:
        print(json.dumps(run_smoke(controller)))
        return 0
    except Exception as error:
        state = getattr(error, 'sqlstate', None) if isinstance(error, RoleProvisioningBlocked) else None
        if not isinstance(state, str) or len(state) != 5 or not state.isascii() or not state.isalnum():
            state = None
        print(json.dumps({'status': 'failed', 'stage': (error.stage if isinstance(error, RoleProvisioningBlocked) and error.stage else controller.stage),
                          'error_code': (error.code if isinstance(error, RoleProvisioningBlocked) and error.code else 'UNEXPECTED_ERROR'),
                          'reason': getattr(error, 'reason', None) if isinstance(error, RoleProvisioningBlocked) else None,
                          'sqlstate': state, 'resource_state': controller.resource_state,
                          'cleanup': controller.cleanup_state,
                          'container_id': controller.container_id, 'run_id': str(controller.plan.run_id)}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
