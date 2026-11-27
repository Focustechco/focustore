from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock
from uuid import uuid4

import pytest
import psycopg
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from scripts import alembic_authorization as guard
from scripts import alembic_executor as executor
from scripts import smoke_alembic_authorization as smoke


@pytest.mark.parametrize('scenario', ['synthetic_commit', 'synthetic_rollback'])
def test_fixed_synthetic_revisions_with_real_alembic_and_memory_sqlite(monkeypatch, scenario):
    monkeypatch.setattr(guard, 'SYNTHETIC_EXECUTION_ENABLED', True)
    engine = create_engine('sqlite:///:memory:')
    with engine.connect() as connection:
        transaction = connection.begin()
        authorization = MagicMock(spec=guard.MigrationAuthorization)
        authorization.profile = scenario
        authorization.operation = 'upgrade:head'
        authorization.connection = connection
        config = Config()
        config.set_main_option('script_location', str(executor.LOCATIONS[scenario]))
        config.attributes.update(connection=connection, disposable_authorization=authorization)
        if scenario == 'synthetic_commit':
            command.upgrade(config, 'head')
            assert connection.execute(text('SELECT count(*) FROM focusstore_alembic_synthetic')).scalar_one() == 1
        else:
            with pytest.raises(guard.MigrationAuthorizationError) as error:
                command.upgrade(config, 'head')
            assert error.value.code == 'SYNTHETIC_EXPECTED_ROLLBACK'
        assert transaction.is_active
        authorization.validate.assert_called_once_with(connection, 'upgrade:head')
        transaction.rollback()
        # SQLite may retain DDL; only DML rollback is asserted here.
        exists = connection.execute(text("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='focusstore_alembic_synthetic'")).scalar_one()
        if exists:
            assert connection.execute(text('SELECT count(*) FROM focusstore_alembic_synthetic')).scalar_one() == 0
    engine.dispose()


def test_synthetic_interlock_and_path_restriction_precede_connections(monkeypatch, capsys):
    monkeypatch.setattr(guard, 'SYNTHETIC_EXECUTION_ENABLED', False)
    engine = Mock(side_effect=AssertionError('engine must not be created'))
    monkeypatch.setattr(executor, 'create_engine', engine)
    with pytest.raises(guard.MigrationAuthorizationError) as error:
        executor.run_synthetic(Mock(), Mock(), 'synthetic_commit')
    assert error.value.code == 'EXECUTION_BLOCKED'
    with pytest.raises(guard.MigrationAuthorizationError) as error:
        executor.run_synthetic(Mock(), Mock(), '../migrations')
    assert error.value.code == 'OPERATION_NOT_AUTHORIZED'
    assert smoke.main(['--execute', '--confirm-disposable']) == 2
    assert 'blocked' in capsys.readouterr().out
    engine.assert_not_called()


def test_synthetic_locations_are_isolated_from_commercial_chain():
    for scenario in ('synthetic_commit', 'synthetic_rollback'):
        location = executor.LOCATIONS[scenario].resolve()
        assert location != executor.LOCATIONS['commercial'].resolve()
        assert Path(location, 'versions').is_dir()


def executor_setup(monkeypatch):
    monkeypatch.setattr(guard, 'SYNTHETIC_EXECUTION_ENABLED', True)
    controller = Mock()
    controller.plan.run_id = uuid4()
    controller.plan.bootstrap_password = 'b' * 48
    controller.container_id = 'a' * 64
    controller.resource_state = 'running_verified'
    plan = SimpleNamespace(migrator_password='m' * 48, application_password='a' * 48,
                           database=guard.DATABASE, schema='public', execution_marker=str(uuid4()))
    monkeypatch.setattr(guard, 'controller_token', Mock(return_value=object()))
    for key in list(executor.os.environ):
        if key.upper().startswith('PG'):
            monkeypatch.delenv(key, raising=False)
    engine, connection, transaction, authorization = Mock(), Mock(), Mock(), Mock()
    engine.connect.return_value = connection
    connection.begin.return_value = transaction
    transaction.is_active = True
    monkeypatch.setattr(executor, 'create_engine', Mock(return_value=engine))
    monkeypatch.setattr(guard, 'MigrationAuthorization', Mock(return_value=authorization))
    monkeypatch.setattr(executor.command, 'upgrade', Mock())
    return controller, plan, engine, connection, transaction, authorization


@pytest.mark.parametrize('primary', ['migration', 'commit', 'success'])
def test_primary_failure_and_cleanup_are_separately_reported(monkeypatch, primary):
    controller, plan, engine, connection, transaction, _ = executor_setup(monkeypatch)
    if primary == 'migration':
        executor.command.upgrade.side_effect = RuntimeError('synthetic-secret')
    if primary == 'commit':
        transaction.commit.side_effect = RuntimeError('synthetic-secret')
    connection.close.side_effect = RuntimeError('synthetic-secret')
    with pytest.raises(executor.MigrationExecutionError) as error:
        executor.run_synthetic(controller, plan, 'synthetic_commit')
    report = error.value.diagnostic
    assert report['error_code'] == {'migration': 'MIGRATION_FAILED', 'commit': 'COMMIT_FAILED', 'success': 'CLEANUP_FAILED'}[primary]
    assert report['cleanup_outcome'] == 'failed'
    assert report['transaction_outcome'] == {'migration': 'rolled_back', 'commit': 'commit_outcome_unknown', 'success': 'committed'}[primary]
    assert report['resource_state'] == 'running_verified'
    assert 'synthetic-secret' not in repr(report)
    engine.dispose.assert_called_once()


def test_rollback_failure_does_not_replace_primary_failure(monkeypatch):
    controller, plan, _, _, transaction, _ = executor_setup(monkeypatch)
    executor.command.upgrade.side_effect = RuntimeError('secret')
    transaction.rollback.side_effect = RuntimeError('secret')
    with pytest.raises(executor.MigrationExecutionError) as error:
        executor.run_synthetic(controller, plan, 'synthetic_rollback')
    assert error.value.diagnostic['error_code'] == 'MIGRATION_FAILED'
    assert error.value.diagnostic['rollback_outcome'] == 'failed'
    assert error.value.diagnostic['transaction_outcome'] == 'rollback_outcome_unknown'


def test_uncertain_commit_remains_unknown_after_rollback_failure(monkeypatch):
    controller, plan, _, _, transaction, _ = executor_setup(monkeypatch)
    transaction.commit.side_effect = RuntimeError('commit error')
    transaction.rollback.side_effect = RuntimeError('rollback error')
    with pytest.raises(executor.MigrationExecutionError) as error:
        executor.run_synthetic(controller, plan, 'synthetic_commit')
    assert error.value.diagnostic['error_code'] == 'COMMIT_FAILED'
    assert error.value.diagnostic['rollback_outcome'] == 'failed'
    assert error.value.diagnostic['transaction_outcome'] == 'commit_outcome_unknown'


def test_conflicting_libpq_environment_rejected_before_engine(monkeypatch):
    controller, plan, _, _, _, _ = executor_setup(monkeypatch)
    monkeypatch.setenv('PGHOST', 'synthetic-secret')
    with pytest.raises(executor.MigrationExecutionError) as error:
        executor.run_synthetic(controller, plan, 'synthetic_commit')
    assert error.value.code == 'CONNECTION_INVALID'
    assert 'synthetic-secret' not in repr(error.value.diagnostic)
    executor.create_engine.assert_not_called()


@pytest.mark.parametrize('scenario', ['synthetic_commit', 'synthetic_rollback'])
def test_direct_synthetic_env_rejects_missing_authorization_before_legacy_engine(monkeypatch, scenario):
    import sqlalchemy
    monkeypatch.setattr(guard, 'SYNTHETIC_EXECUTION_ENABLED', True)
    factory = Mock(side_effect=AssertionError('legacy engine must not be created'))
    monkeypatch.setattr(sqlalchemy, 'engine_from_config', factory)
    config = Config()
    config.set_main_option('script_location', str(executor.LOCATIONS[scenario]))
    with pytest.raises(guard.MigrationAuthorizationError):
        command.upgrade(config, 'head')
    factory.assert_not_called()


@pytest.mark.parametrize('arguments', [[], ['--execute'], ['--confirm-disposable']])
def test_plan_and_single_flags_never_invoke_scenarios(monkeypatch, capsys, arguments):
    operation = Mock(side_effect=AssertionError('no operations allowed'))
    monkeypatch.setattr(smoke, 'run_scenario', operation)
    assert smoke.main(arguments) == (0 if not arguments else 2)
    output = capsys.readouterr().out
    assert ('plan' if not arguments else 'rejected') in output
    operation.assert_not_called()


def test_commercial_interlock_remains_disabled():
    assert guard.OPERATIONAL_EXECUTION_ENABLED is False


def test_synthetic_interlock_is_enabled_for_explicit_rehearsal():
    assert guard.SYNTHETIC_EXECUTION_ENABLED is True


def test_forbidden_write_unexpectedly_accepted_is_rolled_back(monkeypatch):
    from psycopg.pq import TransactionStatus
    controller = Mock()
    controller._inspect.return_value = {'NetworkSettings': {'Networks': {'bridge': {'IPAddress': '172.18.0.2'}}}}
    plan = SimpleNamespace(application_password='synthetic-password', execution_marker='marker')
    connection = MagicMock()
    connection.__enter__.return_value = connection
    connection.info.hostaddr, connection.info.port = '127.0.0.1', 55432
    connection.info.transaction_status = TransactionStatus.IDLE
    cursor = connection.cursor.return_value.__enter__.return_value
    cursor.fetchone.side_effect = [('focusstore_integration_test', 'focusstore_test', 'focusstore_test', '172.18.0.2/32', 5432), ('marker',)]
    pending = []
    statements = []
    def execute(sql):
        statements.append(sql)
        if sql == 'BEGIN':
            connection.info.transaction_status = TransactionStatus.INTRANS
        elif sql == 'ROLLBACK':
            pending.clear()
            connection.info.transaction_status = TransactionStatus.IDLE
        elif sql.startswith('UPDATE public.alembic_version'):
            pending.append('uncommitted change')
    cursor.execute.side_effect = execute
    for key in list(executor.os.environ):
        if key.upper().startswith('PG'):
            monkeypatch.delenv(key, raising=False)
    monkeypatch.setattr(psycopg, 'connect', Mock(return_value=connection))
    with pytest.raises(ValueError):
        smoke.verify_application_denials(controller, plan)
    assert statements[-3:] == ['BEGIN', 'UPDATE public.alembic_version SET version_num = version_num', 'ROLLBACK']
    assert pending == []
    assert connection.info.transaction_status == TransactionStatus.IDLE


def test_application_checks_reject_conflicting_libpq_environment(monkeypatch):
    monkeypatch.setenv('PGHOST', 'synthetic-secret')
    connect = Mock(side_effect=AssertionError('connection forbidden'))
    monkeypatch.setattr(psycopg, 'connect', connect)
    with pytest.raises(ValueError):
        smoke.verify_application_denials(Mock(), Mock())
    connect.assert_not_called()


def test_each_denied_write_uses_own_rolled_back_transaction(monkeypatch):
    from psycopg.pq import TransactionStatus
    controller = Mock()
    controller._inspect.return_value = {'NetworkSettings': {'Networks': {'bridge': {'IPAddress': '172.18.0.2'}}}}
    plan = SimpleNamespace(application_password='synthetic-password', execution_marker='marker')
    connection = MagicMock()
    connection.__enter__.return_value = connection
    connection.info.hostaddr, connection.info.port = '127.0.0.1', 55432
    connection.info.transaction_status = TransactionStatus.IDLE
    cursor = connection.cursor.return_value.__enter__.return_value
    cursor.fetchone.side_effect = [('focusstore_integration_test', 'focusstore_test', 'focusstore_test', '172.18.0.2/32', 5432), ('marker',), ('marker',)]
    statements = []
    def execute(sql):
        statements.append(sql)
        if sql == 'BEGIN':
            connection.info.transaction_status = TransactionStatus.INTRANS
        elif sql == 'ROLLBACK':
            connection.info.transaction_status = TransactionStatus.IDLE
        elif sql.startswith(('UPDATE ', 'INSERT ', 'DELETE ')):
            connection.info.transaction_status = TransactionStatus.INERROR
            raise psycopg.errors.InsufficientPrivilege('synthetic')
    cursor.execute.side_effect = execute
    for key in list(executor.os.environ):
        if key.upper().startswith('PG'):
            monkeypatch.delenv(key, raising=False)
    monkeypatch.setattr(psycopg, 'connect', Mock(return_value=connection))
    smoke.verify_application_denials(controller, plan)
    assert statements.count('BEGIN') == 9
    assert statements.count('ROLLBACK') == 9


def test_uncertain_commit_preserves_container_and_original_diagnostic(monkeypatch):
    from scripts import docker_postgres_adapter as docker, role_provisioning as roles
    monkeypatch.setattr(guard, 'SYNTHETIC_EXECUTION_ENABLED', True)
    controller = Mock()
    controller.plan.run_id = uuid4()
    controller.container_id = 'a' * 64
    controller.resource_state = 'running_verified'
    monkeypatch.setattr(docker, 'DockerPostgresAdapter', Mock(return_value=controller))
    monkeypatch.setattr(roles, 'provision_roles', Mock(return_value=Mock()))
    diag = {'status': 'failed', 'scenario': 'synthetic_commit', 'stage': 'commit', 'error_code': 'COMMIT_FAILED',
            'transaction_outcome': 'commit_outcome_unknown', 'rollback_outcome': 'succeeded', 'cleanup_outcome': 'failed'}
    monkeypatch.setattr(executor, 'run_synthetic', Mock(side_effect=executor.MigrationExecutionError(diag)))
    report = smoke.run_scenario('synthetic_commit')
    assert report['stage'] == 'commit' and report['error_code'] == 'COMMIT_FAILED'
    assert report['transaction_outcome'] == 'commit_outcome_unknown'
    assert report['executor_cleanup_outcome'] == 'failed'
    assert report['cleanup_outcome'] == 'not_attempted'
    controller.stop_and_remove.assert_not_called()
    controller.remove_bootstrap_file.assert_not_called()


def test_failed_rollback_preserves_container(monkeypatch):
    from scripts import docker_postgres_adapter as docker, role_provisioning as roles
    monkeypatch.setattr(guard, 'SYNTHETIC_EXECUTION_ENABLED', True)
    controller = Mock()
    controller.plan.run_id = uuid4()
    controller.container_id = 'a' * 64
    controller.resource_state = 'running_verified'
    monkeypatch.setattr(docker, 'DockerPostgresAdapter', Mock(return_value=controller))
    monkeypatch.setattr(roles, 'provision_roles', Mock(return_value=Mock()))
    diag = {'status': 'failed', 'scenario': 'synthetic_rollback', 'stage': 'migration', 'error_code': 'SYNTHETIC_EXPECTED_ROLLBACK',
            'transaction_outcome': 'not_committed', 'rollback_outcome': 'failed', 'cleanup_outcome': 'succeeded'}
    monkeypatch.setattr(executor, 'run_synthetic', Mock(side_effect=executor.MigrationExecutionError(diag)))
    report = smoke.run_scenario('synthetic_rollback')
    assert report['status'] == 'failed' and report['rollback_outcome'] == 'failed'
    controller.stop_and_remove.assert_not_called()


def test_post_commit_identity_failure_preserves_container_and_stage(monkeypatch):
    from scripts import docker_postgres_adapter as docker, role_provisioning as roles
    monkeypatch.setattr(guard, 'SYNTHETIC_EXECUTION_ENABLED', True)
    controller = Mock()
    controller.plan.run_id = uuid4()
    controller.container_id = 'a' * 64
    controller.resource_state = 'running_verified'
    monkeypatch.setattr(docker, 'DockerPostgresAdapter', Mock(return_value=controller))
    monkeypatch.setattr(roles, 'provision_roles', Mock(return_value=Mock()))
    monkeypatch.setattr(executor, 'run_synthetic', Mock(return_value={
        'stage': 'complete', 'transaction_outcome': 'committed', 'rollback_outcome': 'not_attempted', 'cleanup_outcome': 'succeeded'}))
    monkeypatch.setattr(smoke, 'verify_new_connection', Mock(side_effect=guard.MigrationAuthorizationError('secret', code='IDENTITY_FAILED')))
    report = smoke.run_scenario('synthetic_commit')
    assert report['stage'] == 'verify_new_connection' and report['error_code'] == 'IDENTITY_FAILED'
    assert report['transaction_outcome'] == 'committed' and report['cleanup_outcome'] == 'not_attempted'
    controller.stop_and_remove.assert_not_called()


def test_commit_and_rollback_scenarios_use_separate_controllers(monkeypatch):
    from scripts import docker_postgres_adapter as docker, role_provisioning as roles
    monkeypatch.setattr(guard, 'SYNTHETIC_EXECUTION_ENABLED', True)
    controllers = []
    def make_controller():
        c = Mock()
        c.plan.run_id = uuid4()
        c.container_id = ('a' if not controllers else 'b') * 64
        c.resource_state = 'running_verified'
        controllers.append(c)
        return c
    monkeypatch.setattr(docker, 'DockerPostgresAdapter', make_controller)
    monkeypatch.setattr(roles, 'provision_roles', Mock(return_value=Mock()))
    def run(controller, plan, scenario):
        if scenario == 'synthetic_rollback':
            raise executor.MigrationExecutionError({'error_code': 'SYNTHETIC_EXPECTED_ROLLBACK', 'stage': 'migration',
                'transaction_outcome': 'rolled_back', 'rollback_outcome': 'succeeded', 'cleanup_outcome': 'succeeded'})
        return {'transaction_outcome': 'committed', 'rollback_outcome': 'not_attempted', 'cleanup_outcome': 'succeeded'}
    monkeypatch.setattr(executor, 'run_synthetic', run)
    monkeypatch.setattr(smoke, 'verify_new_connection', Mock())
    monkeypatch.setattr(smoke, 'verify_application_denials', Mock())
    first, second = smoke.run_scenario('synthetic_commit'), smoke.run_scenario('synthetic_rollback')
    assert first['status'] == second['status'] == 'passed'
    assert len(controllers) == 2 and controllers[0] is not controllers[1]
    assert first['run_id'] != second['run_id']
    assert smoke.verify_new_connection.call_count == 3
