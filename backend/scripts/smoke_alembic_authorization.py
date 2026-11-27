"""Fixed synthetic PostgreSQL rehearsals; default mode only prints a plan."""
import argparse
import json


def verify_new_connection(controller, plan, scenario):
    """Use the same validated connection capability; no migrations are executed here."""
    from sqlalchemy import text
    from scripts import alembic_authorization as guard
    from scripts.alembic_executor import migrator_engine

    engine = migrator_engine(controller, plan)
    connection = transaction = authorization = None
    try:
        connection = engine.connect()
        transaction = connection.begin()
        authorization = guard.MigrationAuthorization(controller, connection, plan.execution_marker,
                                                       'upgrade:head', profile=scenario)
        authorization.validate(connection, 'upgrade:head')
        exists = connection.execute(text("SELECT to_regclass('public.focusstore_alembic_synthetic') IS NOT NULL")).scalar_one()
        version_exists = connection.execute(text("SELECT to_regclass('public.alembic_version') IS NOT NULL")).scalar_one()
        if scenario == 'synthetic_commit':
            if not exists or not version_exists:
                raise ValueError('Missing synthetic objects.')
            row = connection.execute(text('SELECT id, value FROM public.focusstore_alembic_synthetic')).one()
            version = connection.execute(text('SELECT version_num FROM public.alembic_version')).scalar_one()
            if tuple(row) != (1, 'synthetic') or version != 'focus_synthetic_commit':
                raise ValueError('Synthetic commit verification failed.')
        elif scenario == 'synthetic_rollback':
            if exists:
                raise ValueError('Synthetic table survived rollback.')
            if version_exists:
                raise ValueError('Alembic version table survived rollback.')
        else:
            raise ValueError('Unexpected scenario.')
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


def verify_application_denials(controller, plan, *, target='synthetic'):
    import os
    import psycopg
    from psycopg.pq import TransactionStatus
    from scripts.docker_postgres_adapter import DATABASE, PORT, _SMOKE_AUTHORIZATION

    target_statements = {
        'synthetic': ("UPDATE public.focusstore_alembic_synthetic SET value = 'forged'",
                      "INSERT INTO public.focusstore_alembic_synthetic (id, value) VALUES (2, 'forged')",
                      'DELETE FROM public.focusstore_alembic_synthetic'),
        'commercial': ('UPDATE public.categories SET name = name',
                       "INSERT INTO public.categories (name, slug) VALUES ('probe', 'probe')",
                       'DELETE FROM public.categories'),
    }
    if target not in target_statements:
        raise ValueError('Unexpected private object target.')
    if any(key.upper().startswith('PG') and value for key, value in os.environ.items()):
        raise ValueError('Conflicting database environment.')
    controller.cluster_identity(_SMOKE_AUTHORIZATION)
    details = controller._inspect('running')
    address = details['NetworkSettings']['Networks']['bridge']['IPAddress']
    with psycopg.connect(host='127.0.0.1', hostaddr='127.0.0.1', port=PORT, dbname=DATABASE,
                         user='focusstore_test', password=plan.application_password, connect_timeout=3,
                         sslmode='disable', autocommit=True,
                         options='-c statement_timeout=5000 -c lock_timeout=2000') as connection:
        with connection.cursor() as cursor:
            if connection.info.hostaddr != '127.0.0.1' or connection.info.port != PORT:
                raise ValueError('Unexpected application endpoint.')
            cursor.execute('SELECT current_database(), current_user, session_user, inet_server_addr()::text, inet_server_port()')
            db, user, session, host, port = cursor.fetchone()
            if (db, user, session, host.split('/')[0], port) != (DATABASE, 'focusstore_test', 'focusstore_test', address, 5432):
                raise ValueError('Unexpected application connection identity.')
            cursor.execute('SELECT marker FROM focusstore_control.run_identity')
            if cursor.fetchone() != (plan.execution_marker,):
                raise ValueError('Unexpected marker.')
            for statement in ('UPDATE public.alembic_version SET version_num = version_num',
                              "INSERT INTO public.alembic_version (version_num) VALUES ('forbidden')",
                              'DELETE FROM public.alembic_version',
                              "UPDATE focusstore_control.run_identity SET marker = 'forged'",
                              "INSERT INTO focusstore_control.run_identity (marker) VALUES ('forged')",
                              'DELETE FROM focusstore_control.run_identity', *target_statements[target]):
                if connection.info.transaction_status != TransactionStatus.IDLE:
                    raise ValueError('Application transaction state invalid.')
                cursor.execute('BEGIN')
                state = None
                try:
                    cursor.execute(statement)
                except psycopg.Error as error:
                    state = error.sqlstate
                finally:
                    cursor.execute('ROLLBACK')
                if connection.info.transaction_status != TransactionStatus.IDLE:
                    raise ValueError('Application rollback was not confirmed.')
                if state != '42501':
                    raise ValueError('Forbidden write was accepted or result was inconclusive.')
            cursor.execute('SELECT marker FROM focusstore_control.run_identity')
            if cursor.fetchone() != (plan.execution_marker,):
                raise ValueError('Marker changed.')
    controller.cluster_identity(_SMOKE_AUTHORIZATION)


def run_scenario(scenario):
    from scripts import alembic_authorization as guard
    from scripts.alembic_executor import run_synthetic, MigrationExecutionError, _resource_details
    from scripts.docker_postgres_adapter import DockerPostgresAdapter, _SMOKE_AUTHORIZATION
    from scripts.role_provisioning import provision_roles

    if not guard.SYNTHETIC_EXECUTION_ENABLED:
        raise guard.MigrationAuthorizationError('Synthetic execution remains blocked.', code='EXECUTION_BLOCKED')
    if scenario not in {'synthetic_commit', 'synthetic_rollback'}:
        raise guard.MigrationAuthorizationError('Unknown scenario.', code='OPERATION_NOT_AUTHORIZED')
    controller = DockerPostgresAdapter()
    stage, result, cleanup = 'preflight', None, 'not_attempted'
    try:
        token = _SMOKE_AUTHORIZATION
        controller.preflight(token)
        stage = 'create'
        controller.create(token)
        stage = 'start'
        controller.start(token)
        stage = 'readiness'
        controller.wait_ready(token)
        stage = 'identity'
        controller.cluster_identity(token)
        stage = 'provision'
        plan = provision_roles(controller, token)
        stage = 'migration'
        try:
            result = run_synthetic(controller, plan, scenario)
        except MigrationExecutionError as error:
            result = error.diagnostic
            if not (scenario == 'synthetic_rollback' and result['error_code'] == 'SYNTHETIC_EXPECTED_ROLLBACK'
                    and result['transaction_outcome'] == 'rolled_back' and result['rollback_outcome'] == 'succeeded'
                    and result['cleanup_outcome'] == 'succeeded'):
                raise
        if scenario == 'synthetic_commit' and result['transaction_outcome'] != 'committed':
            raise ValueError('Commit outcome invalid.')
        stage = 'verify_new_connection'
        verify_new_connection(controller, plan, scenario)
        if scenario == 'synthetic_commit':
            stage = 'verify_application'
            verify_application_denials(controller, plan)
            stage = 'verify_new_connection_after_application'
            verify_new_connection(controller, plan, scenario)
        stage = 'identity'
        controller.cluster_identity(token)
        stage, cleanup = 'cleanup', 'in_progress'
        controller.remove_bootstrap_file(token)
        controller.stop_and_remove(token)
        cleanup = 'completed'
        return {'status': 'passed', 'scenario': scenario, 'stage': 'complete', 'error_code': None,
                'transaction_outcome': result['transaction_outcome'], 'rollback_outcome': result['rollback_outcome'],
                'executor_cleanup_outcome': result['cleanup_outcome'], 'cleanup_outcome': cleanup, **_resource_details(controller)}
    except Exception as error:
        # No cleanup is attempted on an uncertain migration, rollback, or identity.
        code = error.code if isinstance(error, (MigrationExecutionError, guard.MigrationAuthorizationError)) else 'SCENARIO_FAILED'
        diag = result if isinstance(result, dict) else {}
        failure_stage = diag.get('stage', stage) if isinstance(error, MigrationExecutionError) else stage
        return {'status': 'failed', 'scenario': scenario, 'stage': failure_stage, 'error_code': code,
                'transaction_outcome': diag.get('transaction_outcome', 'not_committed'),
                'rollback_outcome': diag.get('rollback_outcome', 'not_attempted'),
                'executor_cleanup_outcome': diag.get('cleanup_outcome', 'not_attempted'),
                'cleanup_outcome': 'failed_or_uncertain' if cleanup == 'in_progress' else cleanup,
                **_resource_details(controller)}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--confirm-disposable', action='store_true')
    parser.add_argument('--scenario', choices=['both'], default='both')
    args = parser.parse_args(argv)
    if not args.execute and not args.confirm_disposable:
        print(json.dumps({'status': 'plan', 'scenario': 'both', 'commercial_migrations': False,
                          'steps': ['separate_containers', 'identity', 'provision', 'synthetic_commit',
                                    'synthetic_rollback', 'verify_new_connections', 'cleanup']}))
        return 0
    if not (args.execute and args.confirm_disposable):
        print(json.dumps({'status': 'rejected'}))
        return 2
    from scripts import alembic_authorization as guard
    if not guard.SYNTHETIC_EXECUTION_ENABLED:
        print(json.dumps({'status': 'blocked', 'reason': 'Synthetic execution interlock is disabled.'}))
        return 2
    results = []
    for scenario in ('synthetic_commit', 'synthetic_rollback'):
        result = run_scenario(scenario)
        results.append(result)
        if result['status'] != 'passed':
            break
    print(json.dumps({'status': 'passed' if len(results) == 2 and all(r['status'] == 'passed' for r in results) else 'failed',
                      'results': results}))
    return 0 if len(results) == 2 and all(r['status'] == 'passed' for r in results) else 1


if __name__ == '__main__':
    raise SystemExit(main())
