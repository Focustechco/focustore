"""Connection-bound migration executor; commercial migrations remain blocked."""
import os
import re
from pathlib import Path
from uuid import UUID
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.pool import NullPool

from scripts import alembic_authorization as guard
from scripts.docker_postgres_adapter import DATABASE, PORT

ROOT = Path(__file__).resolve().parents[1]
LOCATIONS = {'commercial': ROOT / 'migrations',
             'synthetic_commit': ROOT / 'synthetic_alembic' / 'commit',
             'synthetic_rollback': ROOT / 'synthetic_alembic' / 'rollback'}


class MigrationExecutionError(guard.MigrationAuthorizationError):
    def __init__(self, diagnostic):
        super().__init__('Disposable migration failed.', code=diagnostic['error_code'])
        self.diagnostic = diagnostic


def _resource_details(controller):
    identifier = getattr(controller, 'container_id', None)
    if not isinstance(identifier, str) or not re.fullmatch('[0-9a-f]{64}', identifier):
        identifier = None
    try:
        run = str(controller.plan.run_id)
        if str(UUID(run)) != run:
            run = None
    except Exception:
        run = None
    state = getattr(controller, 'resource_state', None)
    allowed = {'not_created', 'creation_outcome_unknown', 'id_recorded_unverified', 'created_verified',
               'start_outcome_unknown', 'running_unverified', 'running_verified', 'exited_verified',
               'stop_outcome_unknown', 'stopped_verified', 'removal_outcome_unknown', 'removed'}
    return {'resource_state': state if isinstance(state, str) and state in allowed else 'unknown',
            'container_id': identifier, 'run_id': run}


def migrator_engine(controller, role_plan):
    """Revalidate the authorized target before constructing a fixed NullPool engine."""
    token = guard.controller_token(controller)
    if any(k.upper().startswith('PG') and v for k, v in os.environ.items()):
        raise guard.MigrationAuthorizationError('Conflicting database environment.', code='CONNECTION_INVALID')
    marker, password = role_plan.execution_marker, role_plan.migrator_password
    if (str(UUID(marker)) != marker or role_plan.database != DATABASE or role_plan.schema != 'public'
            or not isinstance(password, str) or len(password) < 32
            or password in {role_plan.application_password, controller.plan.bootstrap_password}):
        raise guard.MigrationAuthorizationError('Role plan invalid.', code='AUTHORIZATION_INVALID')
    controller.cluster_identity(token)
    controller._inspect('running')
    url = URL.create('postgresql+psycopg', username='focusstore_migrator', password=password,
                     host='127.0.0.1', port=PORT, database=DATABASE)
    return create_engine(url, poolclass=NullPool, hide_parameters=True,
                         connect_args={'connect_timeout': 3, 'sslmode': 'disable', 'hostaddr': '127.0.0.1',
                                       'options': '-c statement_timeout=5000 -c lock_timeout=2000'})


def _execute(controller, role_plan, scenario):
    if scenario not in LOCATIONS:
        raise guard.MigrationAuthorizationError('Unknown fixed scenario.', code='OPERATION_NOT_AUTHORIZED')
    enabled = guard.OPERATIONAL_EXECUTION_ENABLED if scenario == 'commercial' else guard.SYNTHETIC_EXECUTION_ENABLED
    if not enabled:
        raise guard.MigrationAuthorizationError('Disposable migration execution remains blocked.', code='EXECUTION_BLOCKED')
    report = {'status': 'failed', 'scenario': scenario, 'stage': 'authorization', 'error_code': None,
              'transaction_outcome': 'not_committed', 'rollback_outcome': 'not_attempted', 'cleanup_outcome': 'not_attempted'}
    engine = connection = transaction = authorization = None
    main_code = None
    commit_attempted = False
    try:
        marker = role_plan.execution_marker
        report['stage'] = 'connection'
        engine = migrator_engine(controller, role_plan)
        connection = engine.connect()
        report['stage'] = 'transaction'
        transaction = connection.begin()
        authorization = guard.MigrationAuthorization(controller, connection, marker, 'upgrade:head', profile=scenario)
        config = Config(str(ROOT / 'alembic.ini'))
        config.set_main_option('script_location', str(LOCATIONS[scenario]))
        config.attributes['connection'] = connection
        config.attributes['disposable_authorization'] = authorization
        report['stage'] = 'migration'
        command.upgrade(config, 'head')
        report['stage'] = 'revalidation'
        authorization.revalidate(connection)
        report['stage'] = 'commit'
        commit_attempted = True
        report['transaction_outcome'] = 'commit_outcome_unknown'
        transaction.commit()
        report['transaction_outcome'] = 'committed'
        report['status'] = 'passed'
        report['stage'] = 'complete'
    except Exception as error:
        codes = {'authorization': 'AUTHORIZATION_INVALID', 'connection': 'CONNECTION_INVALID',
                 'transaction': 'TRANSACTION_INVALID', 'migration': 'MIGRATION_FAILED',
                 'revalidation': 'REVALIDATION_FAILED', 'commit': 'COMMIT_FAILED'}
        main_code = error.code if isinstance(error, guard.MigrationAuthorizationError) else codes.get(report['stage'], 'UNEXPECTED_ERROR')
        if transaction is not None:
            try:
                if transaction.is_active:
                    transaction.rollback()
                    report['rollback_outcome'] = 'succeeded'
                    if not commit_attempted:
                        report['transaction_outcome'] = 'rolled_back'
                elif not commit_attempted:
                    report['transaction_outcome'] = 'commit_outcome_unknown'
            except Exception:
                report['rollback_outcome'] = 'failed'
                if not commit_attempted:
                    report['transaction_outcome'] = 'rollback_outcome_unknown'
    finally:
        cleanup_failed = False
        cleanup_attempted = False
        for resource, action in ((authorization, 'close'), (connection, 'close'), (engine, 'dispose')):
            if resource is not None:
                cleanup_attempted = True
                try:
                    getattr(resource, action)()
                except Exception:
                    cleanup_failed = True
        report['cleanup_outcome'] = 'failed' if cleanup_failed else ('succeeded' if cleanup_attempted else 'not_attempted')
        if cleanup_failed and main_code is None:
            main_code = 'CLEANUP_FAILED'
            report['stage'] = 'cleanup'
            report['status'] = 'failed'
    report.update(_resource_details(controller))
    report['error_code'] = main_code
    if main_code is not None:
        raise MigrationExecutionError(report) from None
    return report


def upgrade_head(controller, role_plan):
    return _execute(controller, role_plan, 'commercial')


def run_synthetic(controller, role_plan, scenario):
    if scenario not in {'synthetic_commit', 'synthetic_rollback'}:
        raise guard.MigrationAuthorizationError('Unknown fixed scenario.', code='OPERATION_NOT_AUTHORIZED')
    return _execute(controller, role_plan, scenario)
