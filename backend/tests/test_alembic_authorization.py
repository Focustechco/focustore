import runpy
from dataclasses import FrozenInstanceError
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock
from uuid import uuid4

import pytest
import sqlalchemy
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection, URL
from alembic import context, command
from alembic.config import Config
from scripts import alembic_authorization as guard
from scripts import alembic_executor as executor

ENV = Path(__file__).resolve().parents[1] / 'migrations' / 'env.py'


def setup_authorization():
    controller = MagicMock(spec=guard.DockerPostgresAdapter)
    controller.container_id = 'a' * 64
    controller.expected_image_id = 'sha256:' + 'b' * 64
    controller.cluster_id = '123'
    controller.plan = SimpleNamespace()
    controller.plan.run_id = uuid4()
    controller.plan.ownership_token = 'synthetic-secret'
    controller.plan.bootstrap_password = 'synthetic-password'
    controller._inspect.return_value = {'NetworkSettings': {'Networks': {'bridge': {'IPAddress': '172.18.0.2'}}}}
    connection = MagicMock(spec=Connection)
    connection.closed = False
    connection.invalidated = False
    connection.in_transaction.return_value = True
    connection.get_nested_transaction.return_value = None
    transaction = SimpleNamespace(is_active=True)
    driver = SimpleNamespace(info=SimpleNamespace(hostaddr='127.0.0.1', port=55432, transaction_status=guard.TransactionStatus.INTRANS), closed=False, broken=False)
    connection.get_transaction.return_value = transaction
    connection.connection.driver_connection = driver
    connection.engine = SimpleNamespace()
    connection.engine.url = URL.create('postgresql+psycopg', username='focusstore_migrator',
                                       host='127.0.0.1', port=55432, database=guard.DATABASE)
    marker = str(uuid4())
    controller._command.return_value = marker.encode()
    identity, mark = Mock(), Mock()
    identity.one.return_value = (guard.DATABASE, 'focusstore_migrator', 'focusstore_migrator', '172.18.0.2/32', 5432)
    mark.scalar_one.return_value = marker
    xid = Mock()
    xid.scalar_one.return_value = '123456'
    connection.execute.side_effect = [identity, mark, xid, identity, mark, xid]
    return guard.MigrationAuthorization(controller, connection, marker, 'upgrade:head'), controller, connection


def test_authorized_connection_and_transaction_are_used_once():
    authorization, controller, connection = setup_authorization()
    authorization.validate(connection, 'upgrade:head')
    controller.cluster_identity.assert_called_once()
    assert connection.execute.call_count == 3
    with pytest.raises(guard.MigrationAuthorizationError):
        authorization.validate(connection, 'upgrade:head')
    authorization.revalidate(connection)
    authorization.close()
    with pytest.raises(guard.MigrationAuthorizationError):
        authorization.revalidate(connection)


@pytest.mark.parametrize('change', ['closed', 'invalidated', 'ended', 'nested', 'driver_closed', 'driver_broken'])
def test_invalid_connection_or_transaction_blocks_revalidation(change):
    authorization, _, connection = setup_authorization()
    authorization.validate(connection, 'upgrade:head')
    if change == 'closed': connection.closed = True
    if change == 'invalidated': connection.invalidated = True
    if change == 'ended': connection.in_transaction.return_value = False
    if change == 'nested': connection.get_nested_transaction.return_value = object()
    if change == 'driver_closed': connection.connection.driver_connection.closed = True
    if change == 'driver_broken': connection.connection.driver_connection.broken = True
    with pytest.raises(guard.MigrationAuthorizationError) as error:
        authorization.revalidate(connection)
    assert error.value.code == 'REVALIDATION_FAILED'


def test_authorization_identity_is_frozen():
    authorization, _, _ = setup_authorization()
    with pytest.raises(FrozenInstanceError):
        authorization.marker = str(uuid4())


@pytest.mark.parametrize('status', [guard.TransactionStatus.ACTIVE, guard.TransactionStatus.INERROR, guard.TransactionStatus.UNKNOWN])
def test_incompatible_physical_transaction_status_rejected(status):
    authorization, _, connection = setup_authorization()
    connection.connection.driver_connection.info.transaction_status = status
    with pytest.raises(guard.MigrationAuthorizationError) as error:
        authorization.validate(connection, 'upgrade:head')
    assert error.value.code == 'TRANSACTION_INVALID'


def test_idle_before_first_sql_is_allowed_but_idle_before_revalidation_is_not():
    authorization, _, connection = setup_authorization()
    driver = connection.connection.driver_connection
    driver.info.transaction_status = guard.TransactionStatus.IDLE
    original = list(connection.execute.side_effect)
    def first_sql(*args):
        driver.info.transaction_status = guard.TransactionStatus.INTRANS
        return original.pop(0)
    connection.execute.side_effect = first_sql
    authorization.validate(connection, 'upgrade:head')
    driver.info.transaction_status = guard.TransactionStatus.IDLE
    with pytest.raises(guard.MigrationAuthorizationError) as error:
        authorization.revalidate(connection)
    assert error.value.code == 'REVALIDATION_FAILED'


def test_changed_physical_transaction_id_rejected():
    authorization, _, connection = setup_authorization()
    results = list(connection.execute.side_effect)
    results[-1] = Mock()
    results[-1].scalar_one.return_value = '789123'
    connection.execute.side_effect = results
    authorization.validate(connection, 'upgrade:head')
    with pytest.raises(guard.MigrationAuthorizationError) as error:
        authorization.revalidate(connection)
    assert error.value.code == 'REVALIDATION_FAILED'


@pytest.mark.parametrize('field', ['role', 'database', 'marker', 'container', 'cluster', 'connection', 'transaction', 'driver'])
def test_identity_or_connection_mismatch_rejected(field):
    authorization, controller, connection = setup_authorization()
    candidate = connection
    if field == 'role':
        connection.engine.url = connection.engine.url.set(username='focusstore_bootstrap')
    if field == 'database':
        connection.engine.url = connection.engine.url.set(database='postgres')
    if field == 'marker':
        marker_result = Mock()
        marker_result.scalar_one.return_value = 'wrong'
        identity_result = Mock()
        identity_result.one.return_value = (guard.DATABASE, 'focusstore_migrator', 'focusstore_migrator', '172.18.0.2/32', 5432)
        connection.execute.side_effect = [identity_result, marker_result]
    if field == 'container':
        controller.container_id = 'c' * 64
    if field == 'cluster':
        controller.cluster_id = '456'
    if field == 'connection':
        candidate = MagicMock(spec=Connection)
    if field == 'transaction':
        connection.get_transaction.return_value = object()
    if field == 'driver':
        connection.connection.driver_connection = object()
    with pytest.raises(guard.MigrationAuthorizationError) as failure:
        authorization.validate(candidate, 'upgrade:head')
    assert 'synthetic-secret' not in str(failure.value)
    assert 'synthetic-password' not in str(failure.value)


def run_env(monkeypatch, attributes, *, migrate=None, fn_name='upgrade', legacy_url=None):
    # Simulate a later reviewed release; production interlock remains disabled.
    monkeypatch.setattr(guard, 'OPERATIONAL_EXECUTION_ENABLED', True)
    config = MagicMock()
    config.config_file_name = None
    config.attributes = attributes
    authorization = attributes.get('disposable_authorization')
    if isinstance(authorization, Mock) and isinstance(authorization, guard.MigrationAuthorization):
        authorization.profile = 'commercial'
    config.get_main_option.return_value = legacy_url
    fn = Mock()
    fn.__name__ = fn_name
    def fake_operation_check(proxy):
        if proxy.context_opts['fn'].__name__ != 'upgrade':
            raise guard.MigrationAuthorizationError('Operation rejected.', code='OPERATION_NOT_AUTHORIZED')
    monkeypatch.setattr(guard, 'verify_alembic_upgrade', fake_operation_check)
    monkeypatch.setattr(context, 'config', config, raising=False)
    monkeypatch.setattr(context, '_proxy', SimpleNamespace(context_opts={'fn': fn, 'destination_rev': 'head'}), raising=False)
    monkeypatch.setattr(context, 'is_offline_mode', Mock(return_value=False))
    configure = Mock()
    monkeypatch.setattr(context, 'configure', configure)
    monkeypatch.setattr(context, 'begin_transaction', Mock(return_value=MagicMock()))
    monkeypatch.setattr(context, 'run_migrations', Mock(side_effect=migrate))
    return lambda: runpy.run_path(str(ENV)), configure


def test_env_accepts_only_provided_authorized_connection(monkeypatch):
    authorization = MagicMock(spec=guard.MigrationAuthorization)
    connection = object()
    execute, configure = run_env(monkeypatch, {'connection': connection, 'disposable_authorization': authorization})
    engine_factory = Mock(side_effect=AssertionError('unexpected engine'))
    monkeypatch.setattr(sqlalchemy, 'engine_from_config', engine_factory)
    execute()
    authorization.validate.assert_called_once_with(connection, 'upgrade:head')
    assert configure.call_args.kwargs['connection'] is connection
    engine_factory.assert_not_called()


def test_operational_interlock_blocks_even_with_authorization(monkeypatch):
    authorization = MagicMock(spec=guard.MigrationAuthorization)
    execute, configure = run_env(monkeypatch, {'connection': object(), 'disposable_authorization': authorization})
    monkeypatch.setattr(guard, 'OPERATIONAL_EXECUTION_ENABLED', False)
    with pytest.raises(guard.MigrationAuthorizationError):
        execute()
    authorization.validate.assert_not_called()
    configure.assert_not_called()


def test_synthetic_profile_rejects_arbitrary_script_location(monkeypatch, tmp_path):
    authorization = MagicMock(spec=guard.MigrationAuthorization)
    execute, configure = run_env(monkeypatch, {'connection': object(), 'disposable_authorization': authorization}, legacy_url=str(tmp_path))
    authorization.profile = 'synthetic_commit'
    monkeypatch.setattr(guard, 'SYNTHETIC_EXECUTION_ENABLED', True)
    with pytest.raises(guard.MigrationAuthorizationError):
        execute()
    authorization.validate.assert_not_called()
    configure.assert_not_called()


@pytest.mark.parametrize('attributes', [{'connection': object()}, {'disposable_authorization': object()},
                                        {'connection': object(), 'disposable_authorization': object()}])
def test_env_rejects_missing_or_invalid_authorization(monkeypatch, attributes):
    execute, configure = run_env(monkeypatch, attributes)
    with pytest.raises(guard.MigrationAuthorizationError):
        execute()
    configure.assert_not_called()


def test_env_rejects_other_operation_and_propagates_failure(monkeypatch):
    authorization = MagicMock(spec=guard.MigrationAuthorization)
    attrs = {'connection': object(), 'disposable_authorization': authorization}
    execute, _ = run_env(monkeypatch, attrs, fn_name='downgrade')
    with pytest.raises(guard.MigrationAuthorizationError):
        execute()
    authorization.validate.assert_not_called()
    execute, _ = run_env(monkeypatch, attrs, migrate=RuntimeError('simulated failure'))
    with pytest.raises(guard.MigrationAuthorizationError) as failure:
        execute()
    assert 'simulated failure' not in str(failure.value)


def test_caller_transaction_rolls_back_on_simulated_migration_failure(monkeypatch):
    engine = create_engine('sqlite:///:memory:')
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE synthetic_test (value INTEGER)'))
    authorization = MagicMock(spec=guard.MigrationAuthorization)
    with pytest.raises(guard.MigrationAuthorizationError):
        with engine.begin() as connection:
            def simulated_migration():
                connection.execute(text('INSERT INTO synthetic_test VALUES (1)'))
                raise RuntimeError('simulated failure')
            execute, _ = run_env(monkeypatch, {'connection': connection, 'disposable_authorization': authorization}, migrate=simulated_migration)
            execute()
    with engine.connect() as connection:
        assert connection.execute(text('SELECT count(*) FROM synthetic_test')).scalar_one() == 0
    engine.dispose()


@pytest.mark.parametrize('url', [
    'postgresql+psycopg://focusstore_migrator@127.0.0.1:55432/focusstore_integration_test',
    'postgresql+psycopg://focusstore@localhost:5432/focusstore_test',
])
def test_test_postgres_cannot_create_legacy_engine(monkeypatch, url):
    monkeypatch.setenv('FOCUS_TEST_POSTGRES_PROFILE', 'ci')
    execute, _ = run_env(monkeypatch, {}, legacy_url=url)
    engine_factory = Mock(side_effect=AssertionError('unexpected engine'))
    monkeypatch.setattr(sqlalchemy, 'engine_from_config', engine_factory)
    with pytest.raises(RuntimeError):
        execute()
    engine_factory.assert_not_called()


@pytest.mark.parametrize('url,environment', [
    ('postgresql+psycopg://user@host/db?host=127.0.0.1&port=55432', {}),
    ('postgresql+psycopg://user@host/db?service=unsafe', {}),
    ('postgresql+psycopg://user@host/db', {'PGHOST': '127.0.0.1'}),
    ('postgresql+psycopg://user@host/db', {'PGSERVICEFILE': 'secret'}),
    ('postgresql+psycopg://user@host/focusstore_test', {}),
])
def test_ambiguous_legacy_destinations_are_rejected(url, environment):
    with pytest.raises(guard.MigrationAuthorizationError):
        guard.guard_legacy_test_target(sqlalchemy.engine.make_url(url), environment)


def synthetic_alembic(tmp_path, connection, authorization, *, fail=False):
    authorization.profile = 'commercial'
    root = tmp_path / 'synthetic_alembic'
    versions = root / 'versions'
    versions.mkdir(parents=True)
    (root / 'env.py').write_text(ENV.read_text(encoding='utf-8'), encoding='utf-8')
    (versions / 'synthetic.py').write_text(
        'from alembic import op, context\n'
        "revision = 'synthetic01'\ndown_revision = None\nbranch_labels = None\ndepends_on = None\n"
        'def upgrade():\n'
        "    assert op.get_bind() is context.config.attributes['connection']\n"
        '    assert op.get_bind().in_transaction()\n'
        "    op.execute('INSERT INTO synthetic_data (value) VALUES (1)')\n"
        + ("    raise RuntimeError('synthetic-secret')\n" if fail else '')
        + 'def downgrade():\n    pass\n', encoding='utf-8')
    config = Config()
    config.set_main_option('script_location', str(root))
    config.attributes.update(connection=connection, disposable_authorization=authorization)
    return config


def test_real_alembic_upgrade_uses_external_connection_and_rolls_back_dml(tmp_path, monkeypatch):
    monkeypatch.setattr(guard, 'OPERATIONAL_EXECUTION_ENABLED', True)
    engine = create_engine('sqlite:///:memory:')
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE synthetic_data (value INTEGER)'))
    with engine.connect() as connection:
        transaction = connection.begin()
        authorization = MagicMock(spec=guard.MigrationAuthorization)
        config = synthetic_alembic(tmp_path, connection, authorization)
        command.upgrade(config, 'head')
        assert transaction.is_active and connection.in_transaction()
        assert connection.execute(text('SELECT count(*) FROM synthetic_data')).scalar_one() == 1
        authorization.validate.assert_called_once_with(connection, 'upgrade:head')
        transaction.rollback()
        assert connection.execute(text('SELECT count(*) FROM synthetic_data')).scalar_one() == 0
    engine.dispose()


def test_real_alembic_failure_rolls_back_synthetic_dml(tmp_path, monkeypatch):
    monkeypatch.setattr(guard, 'OPERATIONAL_EXECUTION_ENABLED', True)
    engine = create_engine('sqlite:///:memory:')
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE synthetic_data (value INTEGER)'))
    with engine.connect() as connection:
        transaction = connection.begin()
        config = synthetic_alembic(tmp_path, connection, MagicMock(spec=guard.MigrationAuthorization), fail=True)
        with pytest.raises(guard.MigrationAuthorizationError) as error:
            command.upgrade(config, 'head')
        assert 'synthetic-secret' not in str(error.value)
        assert transaction.is_active
        transaction.rollback()
        assert connection.execute(text('SELECT count(*) FROM synthetic_data')).scalar_one() == 0
    engine.dispose()


@pytest.mark.parametrize('operation', ['downgrade', 'stamp', 'offline'])
def test_real_alembic_rejects_unapproved_operations(tmp_path, monkeypatch, operation):
    monkeypatch.setattr(guard, 'OPERATIONAL_EXECUTION_ENABLED', True)
    engine = create_engine('sqlite:///:memory:')
    with engine.connect() as connection:
        transaction = connection.begin()
        authorization = MagicMock(spec=guard.MigrationAuthorization)
        config = synthetic_alembic(tmp_path, connection, authorization)
        with pytest.raises((guard.MigrationAuthorizationError, RuntimeError)):
            if operation == 'downgrade': command.downgrade(config, 'base')
            elif operation == 'stamp': command.stamp(config, 'head')
            else: command.upgrade(config, 'head', sql=True)
        authorization.validate.assert_not_called()
        transaction.rollback()
    engine.dispose()


def test_executor_interlock_prevents_engine_creation(monkeypatch):
    monkeypatch.setattr(guard, 'OPERATIONAL_EXECUTION_ENABLED', False)
    factory = Mock(side_effect=AssertionError('unexpected engine'))
    monkeypatch.setattr(executor, 'create_engine', factory)
    with pytest.raises(guard.MigrationAuthorizationError) as error:
        executor.upgrade_head(Mock(), Mock())
    assert error.value.code == 'EXECUTION_BLOCKED'
    factory.assert_not_called()


@pytest.mark.parametrize('failure_stage', [None, 'migration', 'revalidation', 'commit', 'rollback'])
def test_executor_revalidates_before_commit_and_rolls_back(monkeypatch, failure_stage):
    monkeypatch.setattr(guard, 'OPERATIONAL_EXECUTION_ENABLED', True)
    controller = Mock()
    monkeypatch.setattr(guard, 'controller_token', Mock(return_value=object()))
    plan = SimpleNamespace(migrator_password='x' * 48, application_password='y' * 48,
                           database=guard.DATABASE, schema='public', execution_marker=str(uuid4()))
    engine, connection, transaction, authorization = Mock(), Mock(), Mock(), Mock()
    transaction.is_active = True
    engine.connect.return_value = connection
    connection.begin.return_value = transaction
    monkeypatch.setattr(executor, 'create_engine', Mock(return_value=engine))
    monkeypatch.setattr(guard, 'MigrationAuthorization', Mock(return_value=authorization))
    events = []
    def migrate(*args):
        events.append('migration')
        if failure_stage in {'migration', 'rollback'}: raise RuntimeError('synthetic-secret')
    def revalidate(*args):
        events.append('revalidate')
        if failure_stage == 'revalidation': raise guard.MigrationAuthorizationError('bad', code='REVALIDATION_FAILED')
    def commit():
        events.append('commit')
        if failure_stage == 'commit': raise RuntimeError('synthetic-secret')
    def rollback():
        events.append('rollback')
        if failure_stage == 'rollback': raise RuntimeError('synthetic-secret')
    monkeypatch.setattr(executor.command, 'upgrade', migrate)
    authorization.revalidate.side_effect = revalidate
    transaction.commit.side_effect = commit
    transaction.rollback.side_effect = rollback
    if failure_stage:
        with pytest.raises(guard.MigrationAuthorizationError) as error:
            executor.upgrade_head(controller, plan)
        assert 'synthetic-secret' not in str(error.value)
        assert 'rollback' in events
        expected = {'migration': 'MIGRATION_FAILED', 'revalidation': 'REVALIDATION_FAILED',
                    'commit': 'COMMIT_FAILED', 'rollback': 'MIGRATION_FAILED'}
        assert error.value.code == expected[failure_stage]
        if failure_stage == 'rollback': assert error.value.diagnostic['rollback_outcome'] == 'failed'
        if failure_stage == 'commit': assert error.value.diagnostic['transaction_outcome'] == 'commit_outcome_unknown'
        if failure_stage in {'migration', 'revalidation', 'rollback'}: assert 'commit' not in events
    else:
        executor.upgrade_head(controller, plan)
        assert events == ['migration', 'revalidate', 'commit']
    authorization.close.assert_called_once()
    connection.close.assert_called_once()
    engine.dispose.assert_called_once()
