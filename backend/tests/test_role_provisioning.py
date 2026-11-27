from pathlib import Path
import sys
import json
from unittest.mock import Mock, MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import role_provisioning as roles
import docker_postgres_adapter as adapter
import smoke_postgres_roles as smoke


def test_plan_uses_separate_hidden_credentials():
    plan = roles.RolePlan()
    assert plan.migrator_password != plan.application_password
    assert plan.migrator_password not in repr(plan)
    assert plan.application_password not in repr(plan)
    assert plan.database == 'focusstore_integration_test'


@pytest.mark.parametrize('kwargs', [
    {'database': 'postgres'}, {'schema': 'other'},
    {'migrator_password': 'same', 'application_password': 'same'},
    {'migrator_password': ''},
])
def test_rejects_unexpected_plan(kwargs):
    with pytest.raises(ValueError):
        roles.RolePlan(**kwargs)


def test_provisioner_rejects_invalid_controller_without_connecting(monkeypatch):
    connect = Mock()
    monkeypatch.setattr(roles.psycopg, 'connect', connect)
    controller = Mock()
    with pytest.raises(roles.RoleProvisioningBlocked) as error:
        roles.provision_roles(controller, 'synthetic-secret')
    assert 'synthetic-secret' not in str(error.value)
    connect.assert_not_called()


def setup_provision(monkeypatch, *, identity_override=None):
    controller = adapter.DockerPostgresAdapter()
    controller.cluster_id = '123456789'
    controller.container_id = 'a' * 64
    controller.expected_image_id = 'sha256:' + 'b' * 64
    monkeypatch.setattr(controller, 'cluster_identity', Mock())
    monkeypatch.setattr(controller, '_inspect', Mock(return_value={'NetworkSettings': {'Networks': {'bridge': {'IPAddress': '172.18.0.2'}}}}))
    conn, cursor = MagicMock(), MagicMock()
    conn.__enter__.return_value = conn
    conn.cursor.return_value.__enter__.return_value = cursor
    conn.info.hostaddr, conn.info.port = '127.0.0.1', 55432
    conn.pgconn.encrypt_password.return_value = b'SCRAM-SHA-256$synthetic-verifier'
    cursor.connection = conn
    identity = {'system_identifier': '123456789', 'database': roles.DATABASE,
                'user': roles.BOOTSTRAP, 'session_user': roles.BOOTSTRAP,
                'port': 5432, 'data_directory': adapter.PGDATA, 'address': '172.18.0.2/32'}
    identity.update(identity_override or {})
    cursor.fetchone.side_effect = [(json.dumps(identity),), (True,), None, (True,), (True,), (json.dumps(identity),)]
    connect = Mock(return_value=conn)
    monkeypatch.setattr(roles.psycopg, 'connect', connect)
    for key in list(roles.os.environ):
        if key.upper().startswith('PG'):
            monkeypatch.delenv(key, raising=False)
    return controller, conn, cursor, connect


def test_provision_authorized_in_one_transaction(monkeypatch):
    controller, conn, cursor, connect = setup_provision(monkeypatch)
    plan = roles.provision_roles(controller, adapter._SMOKE_AUTHORIZATION)
    assert plan.migrator_password != plan.application_password
    assert conn.pgconn.encrypt_password.call_count == 2
    assert conn.__exit__.call_args.args == (None, None, None)
    statements = ' '.join(str(call.args[0]) for call in cursor.execute.call_args_list)
    assert 'ALTER DEFAULT PRIVILEGES' in statements and 'REVOKE CONNECT' in statements
    assert 'GRANT ALL' not in statements
    assert plan.migrator_password not in statements and plan.application_password not in statements
    assert connect.call_args.kwargs['hostaddr'] == '127.0.0.1'


@pytest.mark.parametrize('override', [{'system_identifier': '987'}, {'database': 'postgres'}, {'user': 'other'}])
def test_identity_mismatch_rolls_back_and_preserves_resource(monkeypatch, override):
    controller, conn, cursor, _ = setup_provision(monkeypatch, identity_override=override)
    with pytest.raises(roles.RoleProvisioningBlocked):
        roles.provision_roles(controller, adapter._SMOKE_AUTHORIZATION)
    assert conn.__exit__.call_args.args[0] is not None
    assert controller.resource_state == 'not_created'
    assert cursor.execute.call_count == 1


def test_invalid_authorization_never_connects(monkeypatch):
    controller, _, _, connect = setup_provision(monkeypatch)
    with pytest.raises(roles.RoleProvisioningBlocked):
        roles.provision_roles(controller, object())
    connect.assert_not_called()


def test_partial_failure_is_sanitized_and_rolls_back(monkeypatch):
    controller, conn, cursor, _ = setup_provision(monkeypatch)
    conn.pgconn.encrypt_password.side_effect = ValueError('synthetic-secret')
    with pytest.raises(roles.RoleProvisioningBlocked) as error:
        roles.provision_roles(controller, adapter._SMOKE_AUTHORIZATION)
    assert 'synthetic-secret' not in str(error.value)
    assert conn.__exit__.call_args.args[0] is not None


def test_scram_format_and_effective_privilege_failures_roll_back(monkeypatch):
    controller, conn, _, _ = setup_provision(monkeypatch)
    conn.pgconn.encrypt_password.return_value = b'md5-not-scram'
    with pytest.raises(roles.RoleProvisioningBlocked):
        roles.provision_roles(controller, adapter._SMOKE_AUTHORIZATION)
    assert conn.__exit__.call_args.args[0] is not None

    controller, conn, cursor, _ = setup_provision(monkeypatch)
    original = cursor.fetchone.side_effect
    answers = list(original)
    answers[4] = (False,)
    cursor.fetchone.side_effect = answers
    with pytest.raises(roles.RoleProvisioningBlocked):
        roles.provision_roles(controller, adapter._SMOKE_AUTHORIZATION)
    assert conn.__exit__.call_args.args[0] is not None


def test_untrusted_hba_rejected_before_role_creation(monkeypatch):
    controller, conn, cursor, _ = setup_provision(monkeypatch)
    answers = list(cursor.fetchone.side_effect)
    answers[1] = (False,)
    cursor.fetchone.side_effect = answers
    with pytest.raises(roles.RoleProvisioningBlocked):
        roles.provision_roles(controller, adapter._SMOKE_AUTHORIZATION)
    assert conn.__exit__.call_args.args[0] is not None
    assert conn.pgconn.encrypt_password.call_count == 0
    assert 'pg_hba_file_rules' in str(cursor.execute.call_args_list[1])


def test_no_broad_table_or_sequence_grants(monkeypatch):
    controller, _, cursor, _ = setup_provision(monkeypatch)
    roles.provision_roles(controller, adapter._SMOKE_AUTHORIZATION)
    statements = ' '.join(str(call.args[0]) for call in cursor.execute.call_args_list)
    assert 'ON ALL TABLES' not in statements
    assert 'ON ALL SEQUENCES' not in statements
    assert 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES' not in statements
    assert 'focusstore_control.run_identity' in statements


def test_auth_failure_without_sqlstate_is_inconclusive():
    assert smoke._wrong_password(roles.psycopg.OperationalError('synthetic-secret')) == 'indeterminate'
    assert smoke._wrong_password(TimeoutError()) == 'timeout'
    assert smoke._wrong_password(roles.psycopg.errors.InvalidPassword()) == 'rejected'
    assert smoke._wrong_password(roles.psycopg.errors.InvalidCatalogName()) == 'database_missing'


def test_restricted_identity_rejects_wrong_marker():
    cursor = Mock()
    cursor.fetchone.side_effect = [(roles.DATABASE, roles.APPLICATION, roles.APPLICATION, '172.18.0.2/32', 5432), ('wrong',)]
    with pytest.raises(roles.RoleProvisioningBlocked) as error:
        smoke._identity(cursor, roles.APPLICATION, '172.18.0.2', 'expected')
    assert error.value.code == 'ROLE_IDENTITY_MISMATCH'


def test_hba_failure_has_sanitized_stage(monkeypatch):
    controller, _, cursor, _ = setup_provision(monkeypatch)
    answers = list(cursor.fetchone.side_effect)
    answers[1] = (False,)
    cursor.fetchone.side_effect = answers
    with pytest.raises(roles.RoleProvisioningBlocked) as error:
        roles.provision_roles(controller, adapter._SMOKE_AUTHORIZATION)
    assert (error.value.stage, error.value.code) == ('hba_policy', 'HBA_POLICY_REJECTED')
    assert controller.plan.bootstrap_password not in str(error.value)


def test_recovery_script_requires_independent_confirmation_and_reinspection():
    source = (Path(__file__).resolve().parents[1] / 'scripts' / 'recover_disposable_containers.ps1').read_text(encoding='utf-8')
    assert '67f29b83d383f83a5035f6dbbda852c4ccf60e12060b3f9137623af9bf17c329' in source
    assert 'd0a67cee8cf8611eeffd8836ba01625803affd01ac3e6919948188245e0f667b' in source
    assert '$Remove -and $StopContainer' in source
    assert "Assert-Target $target 'running'" in source
    assert "Assert-Target $target 'exited'" in source
    assert "ContainsKey('Confirm')" in source
    assert 'prune' not in source.lower()
    assert 'stop --timeout 10' in source


def test_sqlstate_is_required_for_denied_operation():
    cursor = Mock()
    cursor.execute.side_effect = roles.psycopg.errors.InsufficientPrivilege('hidden')
    smoke._denied(cursor, 'TRUNCATE public.focusstore_role_smoke')
    cursor.execute.side_effect = roles.psycopg.errors.SyntaxError('hidden')
    with pytest.raises(roles.RoleProvisioningBlocked):
        smoke._denied(cursor, 'invalid')


def test_smoke_mode_default_never_connects(monkeypatch, capsys):
    connect = Mock(side_effect=AssertionError('unexpected connection'))
    monkeypatch.setattr(smoke.psycopg, 'connect', connect)
    assert smoke.main([]) == 0
    assert json.loads(capsys.readouterr().out)['status'] == 'plan'
    connect.assert_not_called()


def test_replaced_connection_rejected(monkeypatch):
    controller, conn, cursor, _ = setup_provision(monkeypatch)
    cursor.connection = MagicMock()
    with pytest.raises(roles.RoleProvisioningBlocked):
        roles.provision_roles(controller, adapter._SMOKE_AUTHORIZATION)
    assert conn.__exit__.call_args.args[0] is not None
    cursor.execute.assert_not_called()


def test_role_smoke_failure_preserves_container(monkeypatch):
    controller = Mock()
    monkeypatch.setattr(smoke, 'provision_roles', Mock(side_effect=RuntimeError('secret')))
    with pytest.raises(RuntimeError):
        smoke.run_smoke(controller)
    controller.stop_and_remove.assert_not_called()


def test_simulated_complete_smoke_orders_cleanup_after_checks(monkeypatch):
    controller = Mock()
    plan = roles.RolePlan()
    provision = Mock(return_value=plan)
    verify = Mock()
    monkeypatch.setattr(smoke, 'provision_roles', provision)
    monkeypatch.setattr(smoke, 'verify_roles', verify)
    assert smoke.run_smoke(controller)['status'] == 'passed'
    assert [call[0] for call in controller.method_calls] == [
        'preflight', 'create', 'start', 'wait_ready', 'cluster_identity',
        'remove_bootstrap_file', 'stop_and_remove']
    verify.assert_called_once_with(controller, adapter._SMOKE_AUTHORIZATION, plan)


def test_role_smoke_simulates_allowed_and_denied_operations(monkeypatch):
    controller = Mock()
    controller._inspect.return_value = {'NetworkSettings': {'Networks': {'bridge': {'IPAddress': '172.18.0.2'}}}}
    plan = roles.RolePlan()
    migrator, application = MagicMock(), MagicMock()
    migrator.__enter__.return_value, application.__enter__.return_value = migrator, application
    mc = migrator.cursor.return_value.__enter__.return_value
    ac = application.cursor.return_value.__enter__.return_value
    mc.fetchone.side_effect = [(roles.DATABASE, roles.MIGRATOR, roles.MIGRATOR, '172.18.0.2/32', 5432), (plan.execution_marker,)]
    ac.fetchone.side_effect = [(roles.DATABASE, roles.APPLICATION, roles.APPLICATION, '172.18.0.2/32', 5432), (plan.execution_marker,), (7,), (7,), (1,), (2,), (7,),
                               (roles.DATABASE, roles.APPLICATION, roles.APPLICATION, '172.18.0.2/32', 5432), (plan.execution_marker,)]
    def execute(statement, *args):
        if statement.startswith(('TRUNCATE', 'CREATE TABLE', 'CREATE TEMP', 'SET ROLE', 'SELECT public.focusstore_role_smoke_fn',
                                 'SELECT * FROM public.focusstore_role_', 'INSERT INTO public.focusstore_role_control',
                                 'UPDATE public.focusstore_role_control', 'DELETE FROM public.focusstore_role_control',
                                 "SELECT nextval('public.focusstore_role_private_seq')", 'UPDATE focusstore_control.run_identity')):
            raise roles.psycopg.errors.InsufficientPrivilege('denied')
    ac.execute.side_effect = execute
    def connect(user, password):
        if password.startswith('deliberately-invalid-'):
            raise roles.psycopg.errors.InvalidPassword('rejected')
        return migrator if user == roles.MIGRATOR else application
    monkeypatch.setattr(smoke, '_connect', connect)
    monkeypatch.setattr(smoke, '_verify_wrong_password', Mock(return_value='sqlstate_28p01'))
    smoke.verify_roles(controller, adapter._SMOKE_AUTHORIZATION, plan)
    assert controller.cluster_identity.call_count == 2
    assert any('INSERT INTO' in c.args[0] for c in ac.execute.call_args_list)


def test_wrong_password_requires_correct_auth_before_and_after(monkeypatch):
    controller = Mock()
    valid = Mock()
    monkeypatch.setattr(smoke, '_correct_connection', valid)
    monkeypatch.setattr(smoke, '_connect', Mock(side_effect=roles.psycopg.errors.InvalidPassword('synthetic-secret')))
    assert smoke._verify_wrong_password(controller, object(), roles.MIGRATOR, 'correct', 'marker') == 'sqlstate_28p01'
    assert valid.call_count == 2


def test_wrong_password_without_sqlstate_remains_inconclusive(monkeypatch):
    controller = Mock()
    valid = Mock()
    monkeypatch.setattr(smoke, '_correct_connection', valid)
    monkeypatch.setattr(smoke, '_connect', Mock(side_effect=roles.psycopg.OperationalError('synthetic-secret')))
    monkeypatch.setattr(smoke, 'probe', Mock(side_effect=smoke.ProbeError('indeterminate')))
    with pytest.raises(roles.RoleProvisioningBlocked) as error:
        smoke._verify_wrong_password(controller, object(), roles.MIGRATOR, 'correct', 'marker')
    assert error.value.reason == 'indeterminate'
    assert 'synthetic-secret' not in str(error.value)
    assert valid.call_count == 2


def test_incorrect_password_accepted_and_postcheck_failure_preserve_failure(monkeypatch):
    controller = Mock()
    valid = Mock()
    monkeypatch.setattr(smoke, '_correct_connection', valid)
    monkeypatch.setattr(smoke, '_connect', Mock(return_value=MagicMock()))
    with pytest.raises(roles.RoleProvisioningBlocked) as error:
        smoke._verify_wrong_password(controller, object(), roles.MIGRATOR, 'correct', 'marker')
    assert error.value.reason == 'incorrect_password_accepted'
    valid.side_effect = [None, roles.RoleProvisioningBlocked('identity changed', code='ROLE_IDENTITY_MISMATCH')]
    with pytest.raises(roles.RoleProvisioningBlocked) as error:
        smoke._verify_wrong_password(controller, object(), roles.MIGRATOR, 'correct', 'marker')
    assert error.value.code == 'ROLE_IDENTITY_MISMATCH'


def test_correct_credential_failure_does_not_attempt_wrong_password(monkeypatch):
    controller = Mock()
    controller._inspect.return_value = {'NetworkSettings': {'Networks': {'bridge': {'IPAddress': '172.18.0.2'}}}}
    connect = Mock(side_effect=roles.psycopg.OperationalError('synthetic-secret'))
    monkeypatch.setattr(smoke, '_connect', connect)
    with pytest.raises(roles.RoleProvisioningBlocked) as error:
        smoke._verify_wrong_password(controller, object(), roles.MIGRATOR, 'correct', 'marker')
    assert error.value.code == 'ROLE_CONNECTION_FAILED'
    assert connect.call_count == 1
    assert 'synthetic-secret' not in str(error.value)


def test_inconclusive_psycopg_uses_separate_protocol_probe(monkeypatch):
    valid = Mock()
    monkeypatch.setattr(smoke, '_correct_connection', valid)
    monkeypatch.setattr(smoke, '_connect', Mock(side_effect=roles.psycopg.OperationalError('FATAL:  password authentication failed for user "focusstore_migrator"')))
    raw_probe = Mock(return_value='rejected')
    monkeypatch.setattr(smoke, 'probe', raw_probe)
    assert smoke._verify_wrong_password(Mock(), object(), roles.MIGRATOR, 'correct', 'marker') == 'invalid_scram_proof_sqlstate_28p01'
    assert valid.call_count == 2
    assert raw_probe.call_count == 1


def test_generic_connection_error_cannot_trigger_protocol_fallback(monkeypatch):
    monkeypatch.setattr(smoke, '_correct_connection', Mock())
    monkeypatch.setattr(smoke, '_connect', Mock(side_effect=roles.psycopg.OperationalError('connection refused')))
    raw_probe = Mock(return_value='rejected')
    monkeypatch.setattr(smoke, 'probe', raw_probe)
    with pytest.raises(roles.RoleProvisioningBlocked) as error:
        smoke._verify_wrong_password(Mock(), object(), roles.MIGRATOR, 'correct', 'marker')
    assert error.value.reason == 'indeterminate'
    raw_probe.assert_not_called()


@pytest.mark.parametrize('code', ['PORT_UNAVAILABLE', 'DOCKER_ENV_CONFLICT', 'DOCKER_CONTEXT_MISMATCH',
                                  'DOCKER_ENDPOINT_MISMATCH', 'DOCKER_UNAVAILABLE', 'IMAGE_VALIDATION_FAILED'])
def test_preflight_diagnostic_is_specific_and_sanitized(code):
    controller = Mock()
    controller.preflight.side_effect = adapter.DockerSafetyError('synthetic-secret', code=code)
    with pytest.raises(roles.RoleProvisioningBlocked) as error:
        smoke.run_smoke(controller)
    assert error.value.code == code
    assert 'synthetic-secret' not in str(error.value)
    controller.create.assert_not_called()
