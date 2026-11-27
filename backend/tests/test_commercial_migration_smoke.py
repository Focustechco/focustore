from contextlib import contextmanager
from unittest.mock import MagicMock, Mock
from uuid import uuid4

import pytest
from scripts import alembic_authorization as guard
from scripts import commercial_schema as schema
from scripts import smoke_alembic_commercial as smoke
from scripts.alembic_executor import MigrationExecutionError
from scripts.docker_postgres_adapter import DockerSafetyError


def test_static_inventory_covers_expected_migration_objects():
    tables, indexes, checks, foreign, unique = schema.inventory()
    assert len(tables) == 16 and sum(map(len, tables.values())) == 148
    assert {'categories', 'products', 'stock_reservations', 'orders', 'payment_attempts'} <= set(tables)
    assert tables['products']['public_id'] == ('UUID', False, None)
    assert ('uq_mapping_active_prisma' in indexes and 'ck_products_base_price_nonnegative' in checks['products'])
    assert (('category_id',), ('categories.id',), None) in foreign['products']
    assert ('event_key',) in unique['order_outbox_events']


def test_changed_migration_inventory_is_rejected(monkeypatch, tmp_path):
    monkeypatch.setattr(schema, 'VERSIONS', tmp_path)
    with pytest.raises(schema.SchemaVerificationError) as error:
        schema.inventory()
    assert error.value.code == 'MIGRATION_INVENTORY_CHANGED'


def test_initial_schema_and_missing_objects_are_rejected(monkeypatch):
    inspector = Mock()
    inspector.get_table_names.return_value = ['unexpected']
    monkeypatch.setattr(schema, 'inspect', Mock(return_value=inspector))
    with pytest.raises(schema.SchemaVerificationError) as error:
        schema.verify_initial(Mock())
    assert error.value.code == 'INITIAL_SCHEMA_NOT_EMPTY'
    inspector.get_table_names.return_value = []
    with pytest.raises(schema.SchemaVerificationError) as error:
        schema.verify_structure(Mock())
    assert error.value.code == 'TABLES_MISMATCH'


def test_complete_mock_catalog_and_type_mismatch(monkeypatch):
    tables, indexes, checks, foreign, unique = schema.inventory()
    inspector = Mock()
    inspector.get_table_names.return_value = list(tables) + ['alembic_version']
    def columns(table, schema):
        result = []
        for name, (kind, nullable, default) in tables[table].items():
            type_object = Mock()
            type_object.compile.return_value = kind
            result.append({'name': name, 'type': type_object, 'nullable': nullable, 'default': default})
        return result
    inspector.get_columns.side_effect = columns
    inspector.get_pk_constraint.side_effect = lambda table, schema: {'constrained_columns': ['product_id', 'category_id'] if table == 'product_categories' else ['id']}
    inspector.get_foreign_keys.side_effect = lambda table, schema: [
        {'constrained_columns': list(src), 'referred_table': dst[0].split('.')[0],
         'referred_columns': [d.split('.')[1] for d in dst], 'options': {'ondelete': action} if action else {}}
        for src, dst, action in foreign[table]]
    inspector.get_unique_constraints.side_effect = lambda table, schema: [{'column_names': list(cols)} for cols in unique[table]]
    inspector.get_check_constraints.side_effect = lambda table, schema: [{'name': name} for name in checks[table]]
    inspector.get_indexes.side_effect = lambda table, schema: [
        {'name': name, 'column_names': list(cols), 'unique': unique_flag,
         'dialect_options': {'postgresql_where': "state IN ('candidate','verified')"}}
        for name, (owner, cols, unique_flag) in indexes.items() if owner == table]
    monkeypatch.setattr(schema, 'inspect', Mock(return_value=inspector))
    connection = Mock()
    def execute(statement, *args):
        result = Mock()
        sql = str(statement)
        if 'pg_get_serial_sequence' in sql: result.scalar_one.return_value = 'public.fake_seq'
        elif 'pg_proc' in sql: result.scalars.return_value = list(schema.FUNCTIONS)
        elif 'pg_trigger' in sql: result.scalars.return_value = list(schema.TRIGGERS)
        elif 'pg_class' in sql: result.scalars.return_value = ['focusstore_migrator']
        return result
    connection.execute.side_effect = execute
    schema.verify_structure(connection)
    def wrong_columns(table, schema):
        result = columns(table, schema)
        result[0]['type'].compile.return_value = 'WRONG'
        return result
    inspector.get_columns.side_effect = wrong_columns
    with pytest.raises(schema.SchemaVerificationError) as error:
        schema.verify_structure(connection)
    assert error.value.code == 'COLUMN_DEFINITION_MISMATCH'


def test_revision_and_application_privileges_fail_closed():
    with pytest.raises(schema.SchemaVerificationError) as error:
        schema.verify_revision('wrong')
    assert error.value.code == 'REVISION_MISMATCH'
    connection = Mock()
    connection.execute.return_value.scalar_one.return_value = False
    with pytest.raises(schema.SchemaVerificationError) as error:
        smoke.verify_application_privileges(connection)
    assert error.value.code == 'APPLICATION_PRIVILEGES_INVALID'


def test_plan_and_gate_do_not_create_resources(monkeypatch, capsys):
    monkeypatch.setattr(guard, 'OPERATIONAL_EXECUTION_ENABLED', False)
    controller = Mock(side_effect=AssertionError('no container'))
    monkeypatch.setattr(smoke, 'DockerPostgresAdapter', controller)
    assert smoke.main([]) == 0
    assert 'plan' in capsys.readouterr().out
    assert smoke.main(['--execute']) == 2
    capsys.readouterr()
    assert smoke.main(['--execute', '--confirm-disposable']) == 2
    assert 'blocked' in capsys.readouterr().out
    with pytest.raises(guard.MigrationAuthorizationError) as error:
        smoke.run_smoke()
    assert error.value.code == 'EXECUTION_BLOCKED'
    controller.assert_not_called()


@pytest.mark.parametrize('code', ['PORT_UNAVAILABLE', 'DOCKER_CONTEXT_MISMATCH', 'DOCKER_ENDPOINT_MISMATCH',
                                  'IMAGE_VALIDATION_FAILED', 'DOCKER_ENV_CONFLICT', 'DOCKER_UNAVAILABLE'])
def test_preflight_preserves_specific_sanitized_codes(monkeypatch, code):
    monkeypatch.setattr(guard, 'OPERATIONAL_EXECUTION_ENABLED', True)
    controller = Mock()
    controller.plan.run_id = uuid4()
    controller.container_id = None
    controller.resource_state = 'not_created'
    controller.preflight.side_effect = DockerSafetyError('synthetic-secret', code=code)
    monkeypatch.setattr(smoke, 'DockerPostgresAdapter', Mock(return_value=controller))
    result = smoke.run_smoke()
    assert result['stage'] == 'preflight' and result['error_code'] == code
    assert result['resource_state'] == 'not_created' and 'synthetic-secret' not in repr(result)
    controller.create.assert_not_called()


@pytest.mark.parametrize('failure', ['initial_schema', 'migration_uncertain', 'privileges', 'wrong_revision'])
def test_failures_preserve_container(monkeypatch, failure):
    monkeypatch.setattr(guard, 'OPERATIONAL_EXECUTION_ENABLED', True)
    controller = Mock()
    controller.plan.run_id = uuid4()
    controller.container_id = 'a' * 64
    controller.resource_state = 'running_verified'
    monkeypatch.setattr(smoke, 'DockerPostgresAdapter', Mock(return_value=controller))
    monkeypatch.setattr(smoke, 'provision_roles', Mock(return_value=Mock()))
    conn = MagicMock()
    conn.execute.return_value.scalar_one.return_value = '123456789abc' if failure == 'wrong_revision' else schema.EXPECTED_REVISION
    @contextmanager
    def verified(*args):
        yield conn
    monkeypatch.setattr(smoke, 'verified_connection', verified)
    initial = Mock(side_effect=schema.SchemaVerificationError('INITIAL_SCHEMA_NOT_EMPTY') if failure == 'initial_schema' else None)
    monkeypatch.setattr(smoke, 'verify_initial', initial)
    diag = {'stage': 'commit', 'error_code': 'COMMIT_FAILED', 'transaction_outcome': 'commit_outcome_unknown',
            'rollback_outcome': 'succeeded', 'cleanup_outcome': 'succeeded'}
    upgrade = Mock(side_effect=MigrationExecutionError(diag) if failure == 'migration_uncertain' else None,
                   return_value={'transaction_outcome': 'committed', 'rollback_outcome': 'not_attempted', 'cleanup_outcome': 'succeeded'})
    monkeypatch.setattr(smoke, 'upgrade_head', upgrade)
    monkeypatch.setattr(smoke, 'verify_structure', Mock())
    monkeypatch.setattr(smoke, 'verify_behaviour', Mock())
    monkeypatch.setattr(smoke, 'verify_application_privileges', Mock(side_effect=schema.SchemaVerificationError('APPLICATION_PRIVILEGES_INVALID') if failure == 'privileges' else None))
    result = smoke.run_smoke()
    assert result['status'] == 'failed' and result['cleanup_outcome'] == 'not_attempted'
    if failure == 'migration_uncertain':
        assert result['transaction_outcome'] == 'commit_outcome_unknown'
    if failure == 'wrong_revision':
        assert result['error_code'] == 'REVISION_MISMATCH' and result['observed_revision'] == '123456789abc'
    controller.stop_and_remove.assert_not_called()
