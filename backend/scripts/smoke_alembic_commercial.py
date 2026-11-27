"""Prepared commercial migration rehearsal; execution remains blocked by design."""
import argparse
from contextlib import contextmanager
import json
import re

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from scripts import alembic_authorization as guard
from scripts.alembic_executor import migrator_engine, upgrade_head, MigrationExecutionError, _resource_details
from scripts.commercial_schema import EXPECTED_REVISION, SchemaVerificationError, verify_initial, verify_revision, verify_structure
from scripts.docker_postgres_adapter import DockerPostgresAdapter, DockerSafetyError, _SMOKE_AUTHORIZATION
from scripts.role_provisioning import provision_roles
from scripts.smoke_alembic_authorization import verify_application_denials


@contextmanager
def verified_connection(controller, plan):
    engine = migrator_engine(controller, plan)
    connection = transaction = authorization = None
    try:
        connection = engine.connect()
        transaction = connection.begin()
        authorization = guard.MigrationAuthorization(controller, connection, plan.execution_marker, 'upgrade:head')
        authorization.validate(connection, 'upgrade:head')
        yield connection
        authorization.revalidate(connection)
        transaction.rollback()
    finally:
        if authorization is not None:
            authorization.close()
        if transaction is not None and transaction.is_active:
            transaction.rollback()
        if connection is not None:
            connection.close()
        engine.dispose()


def verify_application_privileges(connection):
    denied = connection.execute(text("""
        SELECT NOT EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relkind IN ('r','p') AND (
            has_table_privilege('focusstore_test',c.oid,'INSERT') OR
            has_table_privilege('focusstore_test',c.oid,'UPDATE') OR
            has_table_privilege('focusstore_test',c.oid,'DELETE') OR
            has_table_privilege('focusstore_test',c.oid,'TRUNCATE')))
    """)).scalar_one()
    if denied is not True:
        raise SchemaVerificationError('APPLICATION_PRIVILEGES_INVALID')


def _expect_integrity(connection, statement, state):
    savepoint = connection.begin_nested()
    try:
        connection.execute(text(statement))
    except IntegrityError as error:
        if getattr(error.orig, 'sqlstate', None) != state:
            raise SchemaVerificationError('INVARIANT_WRONG_SQLSTATE') from None
    else:
        raise SchemaVerificationError('INVARIANT_NOT_ENFORCED')
    finally:
        savepoint.rollback()


def verify_behaviour(connection):
    """Small synthetic checks; the caller rolls back the outer transaction."""
    connection.execute(text("INSERT INTO categories (name, slug) VALUES ('probe', 'focusstore-smoke-probe')"))
    _expect_integrity(connection, "INSERT INTO categories (name, slug) VALUES ('probe', 'focusstore-smoke-probe')", '23505')
    _expect_integrity(connection, "INSERT INTO products (name, price, stock, category_id) VALUES ('probe', 0, 0, -1)", '23514')
    _expect_integrity(connection, "INSERT INTO products (name, price, stock, category_id) VALUES ('probe', 1, 0, -1)", '23503')


def run_smoke():
    if not guard.OPERATIONAL_EXECUTION_ENABLED:
        raise guard.MigrationAuthorizationError('Commercial execution remains blocked.', code='EXECUTION_BLOCKED')
    controller = DockerPostgresAdapter()
    stage, result, cleanup, observed = 'preflight', None, 'not_attempted', None
    try:
        auth = _SMOKE_AUTHORIZATION
        controller.preflight(auth)
        stage = 'create'
        controller.create(auth)
        stage = 'start'
        controller.start(auth)
        stage = 'readiness'
        controller.wait_ready(auth)
        stage = 'identity'
        controller.cluster_identity(auth)
        stage = 'provision'
        plan = provision_roles(controller, auth)
        stage = 'initial_schema'
        with verified_connection(controller, plan) as connection:
            verify_initial(connection)
        stage = 'migration'
        result = upgrade_head(controller, plan)
        if result['transaction_outcome'] != 'committed' or result['cleanup_outcome'] != 'succeeded':
            raise SchemaVerificationError('TRANSACTION_OUTCOME_INVALID')
        stage = 'structure'
        with verified_connection(controller, plan) as connection:
            observed = connection.execute(text('SELECT version_num FROM public.alembic_version')).scalar_one()
            verify_revision(observed)
            verify_structure(connection)
            verify_application_privileges(connection)
            verify_behaviour(connection)
        stage = 'application_privileges'
        verify_application_denials(controller, plan, target='commercial')
        stage = 'post_verification'
        with verified_connection(controller, plan) as connection:
            verify_revision(connection.execute(text('SELECT version_num FROM public.alembic_version')).scalar_one())
            verify_structure(connection)
        stage = 'identity'
        controller.cluster_identity(auth)
        stage, cleanup = 'cleanup', 'in_progress'
        controller.remove_bootstrap_file(auth)
        controller.stop_and_remove(auth)
        return {'status': 'passed', 'stage': 'complete', 'error_code': None,
                'transaction_outcome': result['transaction_outcome'], 'rollback_outcome': result['rollback_outcome'],
                'cleanup_outcome': 'completed', 'expected_revision': EXPECTED_REVISION,
                'observed_revision': observed, **_resource_details(controller)}
    except Exception as error:
        if isinstance(error, MigrationExecutionError):
            result = error.diagnostic
            stage = result['stage']
        allowed = {'PORT_UNAVAILABLE', 'DOCKER_CONTEXT_MISMATCH', 'DOCKER_ENDPOINT_MISMATCH',
                   'IMAGE_VALIDATION_FAILED', 'DOCKER_ENV_CONFLICT', 'DOCKER_UNAVAILABLE'}
        if isinstance(error, (MigrationExecutionError, guard.MigrationAuthorizationError, SchemaVerificationError)):
            code = error.code
        elif isinstance(error, DockerSafetyError) and error.code in allowed:
            code = error.code
        else:
            code = 'COMMERCIAL_SMOKE_FAILED'
        # An unexpected database value is not reported verbatim.
        safe_observed = observed if isinstance(observed, str) and re.fullmatch(r'[0-9a-f]{12}', observed) else None
        diag = result if isinstance(result, dict) else {}
        return {'status': 'failed', 'stage': stage, 'error_code': code,
                'transaction_outcome': diag.get('transaction_outcome', 'not_committed'),
                'rollback_outcome': diag.get('rollback_outcome', 'not_attempted'),
                'executor_cleanup_outcome': diag.get('cleanup_outcome', 'not_attempted'),
                'cleanup_outcome': 'failed_or_uncertain' if cleanup == 'in_progress' else cleanup,
                'expected_revision': EXPECTED_REVISION, 'observed_revision': safe_observed,
                **_resource_details(controller)}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--confirm-disposable', action='store_true')
    args = parser.parse_args(argv)
    if not args.execute and not args.confirm_disposable:
        print(json.dumps({'status': 'plan', 'expected_revision': EXPECTED_REVISION, 'commercial_interlock': 'closed'}))
        return 0
    if not (args.execute and args.confirm_disposable):
        print(json.dumps({'status': 'rejected'}))
        return 2
    if not guard.OPERATIONAL_EXECUTION_ENABLED:
        print(json.dumps({'status': 'blocked', 'error_code': 'EXECUTION_BLOCKED'}))
        return 2
    report = run_smoke()
    print(json.dumps(report))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
