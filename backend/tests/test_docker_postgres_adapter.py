from pathlib import Path
import json
import subprocess
import sys
from unittest.mock import MagicMock, Mock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import docker_postgres_adapter as adapter
import smoke_docker_postgres as smoke


CONTAINER_ID = 'a' * 64
IMAGE_ID = 'sha256:' + 'b' * 64
CONTEXT = [{'Name': 'desktop-linux', 'Endpoints': {'docker': {'Host': adapter.ENDPOINT}}}]
SERVER = {'Os': 'linux', 'Arch': 'amd64'}


def inspection(plan, state='created'):
    ports = {'5432/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '55432'}]}
    return {
        'Id': CONTAINER_ID, 'Name': '/' + plan.name, 'Image': IMAGE_ID,
        'Config': {'Image': adapter.IMAGE, 'Labels': plan.labels, 'Entrypoint': ['/bin/sh'],
                   'Cmd': ['-c', adapter.BOOTSTRAP], 'OpenStdin': True, 'Tty': False, 'User': '',
                   'Env': ['POSTGRES_USER=focusstore_bootstrap', 'POSTGRES_DB=focusstore_integration_test',
                           'POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256 --auth-local=scram-sha-256',
                           'POSTGRES_HOST_AUTH_METHOD=scram-sha-256',
                           f'PGDATA={adapter.PGDATA}']},
        'State': {'Status': state},
        'HostConfig': {'PortBindings': ports, 'NetworkMode': 'bridge', 'IpcMode': 'private', 'Privileged': False,
                       'RestartPolicy': {'Name': 'no'},
                       'Tmpfs': {adapter.DATA_MOUNT: adapter.TMPFS_OPTIONS}},
        'Mounts': [],
        'NetworkSettings': {'Networks': {'bridge': {'IPAddress': '172.18.0.2'}}, 'Ports': ports if state == 'running' else None},
    }


def test_context_endpoint_and_architecture_fail_closed():
    adapter.check_environment('desktop-linux', CONTEXT, SERVER, {})
    for context, metadata, server, environment in [
        ('other', CONTEXT, SERVER, {}),
        ('desktop-linux', [{'Name': 'desktop-linux', 'Endpoints': {'docker': {'Host': 'tcp://remote:2375'}}}], SERVER, {}),
        ('desktop-linux', CONTEXT, {'Os': 'windows', 'Arch': 'amd64'}, {}),
        ('desktop-linux', CONTEXT, {'Os': 'linux', 'Arch': 'unknown'}, {}),
        ('desktop-linux', CONTEXT, SERVER, {'DOCKER_HOST': 'tcp://remote:2375'}),
    ]:
        with pytest.raises(adapter.DockerSafetyError):
            adapter.check_environment(context, metadata, server, environment)


def test_rejects_environment_override_before_docker_inspection(monkeypatch):
    monkeypatch.setenv('DOCKER_HOST', 'tcp://remote:2375')
    run = Mock(side_effect=AssertionError('unexpected subprocess'))
    monkeypatch.setattr(adapter.subprocess, 'run', run)
    with pytest.raises(adapter.DockerSafetyError):
        adapter.DockerPostgresAdapter().inspect_environment()
    run.assert_not_called()


def test_image_digest_and_identity():
    image = [{'Id': IMAGE_ID, 'RepoDigests': [adapter.IMAGE], 'Os': 'linux', 'Architecture': 'amd64',
              'Config': {'Volumes': {adapter.DATA_MOUNT: {}}, 'Env': [f'PGDATA={adapter.PGDATA}']}}]
    assert adapter.image_id(image) == IMAGE_ID
    assert adapter.image_id([{**image[0], 'RepoDigests': [adapter.IMAGE.replace('docker.io/library/', '')]}]) == IMAGE_ID
    with pytest.raises(adapter.DockerSafetyError):
        adapter.image_id(image, expected_architecture='arm64')
    for invalid in [[], [{**image[0], 'Id': 'sha256:bad'}],
                    [{**image[0], 'RepoDigests': ['postgres@sha256:' + 'c' * 64]}],
                    [{**image[0], 'RepoDigests': ['other/postgres@' + adapter.IMAGE.split('@')[1]]}],
                    [{**image[0], 'Config': {'Volumes': {'/extra': {}}, 'Env': [f'PGDATA={adapter.PGDATA}']}}],
                    [{**image[0], 'Config': {'Volumes': {adapter.DATA_MOUNT: {}}, 'Env': ['PGDATA=/tmp']}}],
                    [{**image[0], 'Os': 'windows'}]]:
        with pytest.raises(adapter.DockerSafetyError):
            adapter.image_id(invalid)


def test_environment_inspection_simulated_in_order(monkeypatch):
    for key in ('DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH'):
        monkeypatch.delenv(key, raising=False)
    image = [{'Id': IMAGE_ID, 'RepoDigests': [adapter.IMAGE], 'Os': 'linux', 'Architecture': 'amd64',
              'Config': {'Volumes': {adapter.DATA_MOUNT: {}}, 'Env': [f'PGDATA={adapter.PGDATA}']}}]
    read = Mock(side_effect=['desktop-linux', CONTEXT, SERVER, image])
    monkeypatch.setattr(adapter, '_read_docker', read)
    assert adapter.DockerPostgresAdapter().inspect_environment() == IMAGE_ID
    assert read.call_count == 4
    read.reset_mock(side_effect=True)
    read.side_effect = ['unexpected', CONTEXT]
    with pytest.raises(adapter.DockerSafetyError) as error:
        adapter.DockerPostgresAdapter().inspect_environment()
    assert error.value.code == 'DOCKER_CONTEXT_MISMATCH'
    assert read.call_count == 1


def test_occupied_port_is_rejected_without_real_socket(monkeypatch):
    listener = MagicMock()
    listener.__enter__.return_value = listener
    listener.__exit__.return_value = False
    listener.bind.side_effect = OSError('occupied')
    monkeypatch.setattr(adapter.socket, 'socket', Mock(return_value=listener))
    with pytest.raises(adapter.DockerSafetyError):
        adapter.check_port_available()
    listener.bind.assert_called_once_with(('127.0.0.1', 55432))


@pytest.mark.parametrize('mutation', [
    lambda d: d.update(Id='c' * 64),
    lambda d: d.update(Image='sha256:' + 'c' * 64),
    lambda d: d['Config']['Labels'].update({adapter.RUN_LABEL: 'wrong'}),
    lambda d: d['Config']['Env'].append('POSTGRES_PASSWORD=synthetic-secret'),
    lambda d: d['Config'].update(Env=['POSTGRES_USER=focusstore_bootstrap', 'POSTGRES_DB=focusstore_integration_test', 'PGDATA=/tmp']),
    lambda d: d['Config'].update(Entrypoint=['/bin/other']),
    lambda d: d['Config'].update(Cmd=['-c', 'other']),
    lambda d: d['Config'].update(Tty=True),
    lambda d: d['HostConfig'].update(RestartPolicy={'Name': 'always'}),
    lambda d: d['HostConfig'].update(PortBindings={'5432/tcp': [{'HostIp': '0.0.0.0', 'HostPort': '55432'}]}),
    lambda d: d['HostConfig'].update(Privileged=True),
    lambda d: d['HostConfig'].update(Binds=['/host:/container']),
    lambda d: d['HostConfig'].update(Tmpfs={}),
    lambda d: d['HostConfig'].update(NetworkMode='host'),
    lambda d: d['HostConfig'].update(PidMode='host'),
    lambda d: d['HostConfig'].update(IpcMode='host'),
    lambda d: d['HostConfig'].update(SecurityOpt=['seccomp=unconfined']),
    lambda d: d['Mounts'].append({'Type': 'volume', 'Destination': adapter.DATA_MOUNT}),
    lambda d: d['Mounts'].append({'Type': 'bind', 'Destination': '/var/run/docker.sock'}),
    lambda d: d['NetworkSettings'].update(Networks={'unexpected': {}}),
    lambda d: d['NetworkSettings'].update(Ports={'5432/tcp': [{'HostIp': '0.0.0.0', 'HostPort': '55432'}]}),
])
def test_rejects_untrusted_container_settings(mutation):
    plan = adapter.RunPlan()
    details = inspection(plan, 'running')
    mutation(details)
    with pytest.raises(adapter.DockerSafetyError):
        adapter.validate_container(details, plan, IMAGE_ID, CONTAINER_ID, expected_state='running')


def test_rejects_foreign_container_and_invalid_state():
    plan = adapter.RunPlan()
    with pytest.raises(adapter.DockerSafetyError):
        adapter.validate_container(inspection(plan), plan, IMAGE_ID, 'c' * 64, expected_state='created')
    with pytest.raises(adapter.DockerSafetyError):
        adapter.validate_container(inspection(plan), plan, IMAGE_ID, CONTAINER_ID, expected_state='running')


def test_read_only_subprocess_is_bounded_and_redacts_failures(monkeypatch):
    run = Mock(return_value=subprocess.CompletedProcess([], 0, stdout=json.dumps(SERVER), stderr=''))
    monkeypatch.setattr(adapter.subprocess, 'run', run)
    assert adapter._read_docker('--context', 'desktop-linux', 'version', '--format', '{{json .Server}}') == SERVER
    assert run.call_args.kwargs['shell'] is False
    assert run.call_args.kwargs['timeout'] == 10
    for failure in [subprocess.TimeoutExpired('docker', 10), subprocess.CalledProcessError(1, 'docker', stderr='synthetic-secret'), OSError('synthetic-secret')]:
        run.side_effect = failure
        with pytest.raises(adapter.DockerSafetyError) as error:
            adapter._read_docker('context', 'show')
        assert 'synthetic-secret' not in str(error.value)
    run.reset_mock()
    with pytest.raises(adapter.DockerSafetyError):
        adapter._read_docker('rm', CONTAINER_ID)
    run.assert_not_called()


def test_credentials_are_separate_and_absent_from_plan_arguments():
    plan = adapter.RunPlan()
    assert plan.bootstrap_password != plan.application_password
    for value in (repr(plan), repr(plan.create_arguments()), repr(plan.labels)):
        assert plan.bootstrap_password not in value
        assert plan.application_password not in value
    command = plan.create_arguments()
    assert '--interactive' in command
    assert command[command.index('--pull') + 1] == 'never'
    assert f'{adapter.DATA_MOUNT}:{adapter.TMPFS_OPTIONS}' in command
    assert 'read -r bootstrap_password' in adapter.BOOTSTRAP
    assert 'chown postgres:postgres' in adapter.BOOTSTRAP
    assert 'chmod 0600' in adapter.BOOTSTRAP


def test_requires_scram_entrypoint_configuration():
    plan = adapter.RunPlan()
    args = plan.create_arguments()
    assert 'POSTGRES_HOST_AUTH_METHOD=scram-sha-256' in args
    assert 'POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256 --auth-local=scram-sha-256' in args
    details = inspection(plan)
    details['Config']['Env'].remove('POSTGRES_HOST_AUTH_METHOD=scram-sha-256')
    with pytest.raises(adapter.DockerSafetyError):
        adapter.validate_container(details, plan, IMAGE_ID, CONTAINER_ID, expected_state='created')


def test_specific_preflight_guard_codes():
    with pytest.raises(adapter.DockerSafetyError) as error:
        adapter.check_environment_overrides({'DOCKER_HOST': 'synthetic-secret'})
    assert error.value.code == 'DOCKER_ENV_CONFLICT'
    assert 'synthetic-secret' not in str(error.value)
    with pytest.raises(adapter.DockerSafetyError) as error:
        adapter.check_context('desktop-linux', [{'Name': 'desktop-linux', 'Endpoints': {'docker': {'Host': 'unexpected'}}}], {})
    assert error.value.code == 'DOCKER_ENDPOINT_MISMATCH'
    with pytest.raises(adapter.DockerSafetyError) as error:
        adapter.check_context('other', CONTEXT, {})
    assert error.value.code == 'DOCKER_CONTEXT_MISMATCH'


def test_simulated_lifecycle_and_prohibition_of_real_operations(monkeypatch):
    control = adapter.DockerPostgresAdapter()
    plan = control.plan
    run = Mock(side_effect=AssertionError('Docker lifecycle must not execute'))
    monkeypatch.setattr(adapter.subprocess, 'run', run)
    fake = Mock()
    fake.create.return_value = CONTAINER_ID
    fake.inspect.side_effect = [inspection(plan, state) for state in ('created', 'running', 'exited')]
    created_id = fake.create(plan.create_arguments())
    adapter.validate_container(fake.inspect(created_id), plan, IMAGE_ID, created_id, expected_state='created')
    fake.start(created_id)
    adapter.validate_container(fake.inspect(created_id), plan, IMAGE_ID, created_id, expected_state='running')
    adapter.validate_cluster_identifier('123456789', '123456789')
    fake.stop(created_id)
    adapter.validate_container(fake.inspect(created_id), plan, IMAGE_ID, created_id, expected_state='exited')
    fake.remove(created_id)
    fake.remove.assert_called_once_with(CONTAINER_ID)
    with pytest.raises(adapter.DockerSafetyError):
        adapter.validate_cluster_identifier('123456789', '987654321')
    for operation in (control.create, control.start, lambda: control.remove(CONTAINER_ID), control.cluster_identity):
        with pytest.raises(adapter.DockerSafetyError):
            operation()
    run.assert_not_called()


def simulated_controller(monkeypatch, *, external_id='123456789', authentication_error=False):
    import psycopg

    control = adapter.DockerPostgresAdapter()
    state = {'value': 'created', 'commands': []}
    identity = {'system_identifier': '123456789', 'database': adapter.DATABASE, 'user': adapter.USER,
                'session_user': adapter.USER, 'port': 5432, 'data_directory': adapter.PGDATA}

    def command(args, *, input_data=None, timeout=10):
        state['commands'].append(args)
        if args[0] == 'create':
            return (CONTAINER_ID + '\n').encode()
        if args[0] == 'start':
            state['value'] = 'running'
        if args[0] == 'stop':
            state['value'] = 'exited'
        if adapter.IDENTITY_SQL in args:
            assert input_data == (control.plan.bootstrap_password + '\n').encode()
            return json.dumps({**identity, 'address': '127.0.0.1/32'}).encode()
        return b''

    def read(*args, **kwargs):
        assert args[-1] == CONTAINER_ID
        return [inspection(control.plan, state['value'])]

    connection = MagicMock()
    cursor = connection.__enter__.return_value.cursor.return_value.__enter__.return_value
    cursor.fetchone.return_value = (json.dumps({**identity, 'system_identifier': external_id, 'address': '172.18.0.2/32'}),)
    connect = Mock(side_effect=RuntimeError('synthetic secret') if authentication_error else None, return_value=connection)
    monkeypatch.setattr(psycopg, 'connect', connect)
    monkeypatch.setattr(control, 'inspect_environment', Mock(return_value=IMAGE_ID))
    monkeypatch.setattr(control, '_check_context', Mock())
    monkeypatch.setattr(adapter, 'check_port_available', Mock())
    monkeypatch.setattr(adapter, '_read_docker', read)
    monkeypatch.setattr(control, '_command', command)
    def attached_start(*args, **kwargs):
        state['value'] = 'running'
        process = MagicMock()
        process.poll.return_value = None
        return process
    monkeypatch.setattr(adapter.subprocess, 'Popen', Mock(side_effect=attached_start))
    for key in list(adapter.os.environ):
        if key.upper().startswith('PG'):
            monkeypatch.delenv(key, raising=False)
    return control, state, connect


def test_real_controller_simulated_positive_lifecycle(monkeypatch):
    control, state, connect = simulated_controller(monkeypatch)
    report = smoke.run_smoke(control)
    assert report['status'] == 'passed'
    assert [args[0] for args in state['commands']] == ['create', 'exec', 'exec', 'exec', 'exec', 'stop', 'rm']
    assert connect.call_count == 2
    assert control.plan.bootstrap_password not in repr(state['commands'])
    assert control.plan.application_password not in repr(state['commands'])
    assert control.plan.bootstrap_password not in repr(report)
    cleanup = next(args for args in state['commands'] if any('stat -c %u:%g:%a' in value for value in args))
    assert any('test ! -L' in value and 'tmpfs' in value for value in cleanup)


@pytest.mark.parametrize('external_id,authentication_error', [('987654321', False), ('123456789', True)])
def test_identity_failure_preserves_container(monkeypatch, external_id, authentication_error):
    control, state, _ = simulated_controller(monkeypatch, external_id=external_id, authentication_error=authentication_error)
    with pytest.raises(adapter.DockerSafetyError) as failure:
        smoke.run_smoke(control)
    assert 'synthetic secret' not in str(failure.value)
    assert not any(args[0] in {'stop', 'rm'} for args in state['commands'])


def test_plan_mode_and_flags_do_not_start_docker(monkeypatch, capsys):
    run = Mock(side_effect=AssertionError('unexpected Docker execution'))
    monkeypatch.setattr(adapter.subprocess, 'run', run)
    assert smoke.main([]) == 0
    assert json.loads(capsys.readouterr().out)['status'] == 'plan'
    assert smoke.main(['--execute']) == 2
    run.assert_not_called()


@pytest.mark.parametrize('stage', ['create', 'start'])
def test_create_or_start_failure_preserves_resources(monkeypatch, stage):
    control, state, _ = simulated_controller(monkeypatch)
    original = control._command

    def fail_command(args, **kwargs):
        if args[0] == stage:
            raise adapter.DockerSafetyError('synthetic failure')
        return original(args, **kwargs)

    monkeypatch.setattr(control, '_command', fail_command)
    if stage == 'start':
        monkeypatch.setattr(adapter.subprocess, 'Popen', Mock(side_effect=OSError('synthetic failure')))
    with pytest.raises(adapter.DockerSafetyError):
        smoke.run_smoke(control)
    assert not any(args[0] in {'stop', 'rm'} for args in state['commands'])


def test_readiness_timeout_preserves_container(monkeypatch):
    control, state, _ = simulated_controller(monkeypatch)
    original = control._command

    def fail_ready(args, **kwargs):
        if 'pg_isready' in args:
            raise adapter.DockerSafetyError('synthetic not ready')
        return original(args, **kwargs)

    monkeypatch.setattr(control, '_command', fail_ready)
    monkeypatch.setattr(adapter.time, 'monotonic', Mock(side_effect=[0, 0, 61]))
    monkeypatch.setattr(adapter.time, 'sleep', Mock())
    with pytest.raises(adapter.DockerSafetyError) as failure:
        smoke.run_smoke(control)
    assert failure.value.code == 'READINESS_TIMEOUT'
    assert not any(args[0] in {'stop', 'rm'} for args in state['commands'])


def test_foreign_container_is_not_removed(monkeypatch):
    control, state, _ = simulated_controller(monkeypatch)
    control.container_id = CONTAINER_ID
    control.expected_image_id = IMAGE_ID
    control.cluster_id = '123456789'
    foreign = inspection(control.plan, 'running')
    foreign['Config']['Labels'][adapter.TOKEN_LABEL] = 'other-owner'
    monkeypatch.setattr(adapter, '_read_docker', Mock(return_value=[foreign]))
    with pytest.raises(adapter.DockerSafetyError):
        control.stop_and_remove(adapter._SMOKE_AUTHORIZATION)
    assert not any(args[0] in {'stop', 'rm'} for args in state['commands'])


def test_failed_preflight_cannot_authorize_creation(monkeypatch):
    control = adapter.DockerPostgresAdapter()
    monkeypatch.setattr(control, 'inspect_environment', Mock(return_value=IMAGE_ID))
    monkeypatch.setattr(adapter, 'check_port_available', Mock(side_effect=adapter.DockerSafetyError('occupied')))
    run = Mock(side_effect=AssertionError('unexpected command'))
    monkeypatch.setattr(control, '_command', run)
    with pytest.raises(adapter.DockerSafetyError):
        control.preflight(adapter._SMOKE_AUTHORIZATION)
    assert control.expected_image_id is None
    with pytest.raises(adapter.DockerSafetyError):
        control.create(adapter._SMOKE_AUTHORIZATION)
    run.assert_not_called()


def test_lifecycle_subprocess_failures_do_not_disclose_input(monkeypatch):
    control = adapter.DockerPostgresAdapter()
    monkeypatch.setattr(control, '_check_context', Mock())
    run = Mock(side_effect=subprocess.CalledProcessError(1, 'docker', stderr='synthetic-secret'))
    monkeypatch.setattr(adapter.subprocess, 'run', run)
    with pytest.raises(adapter.DockerSafetyError) as failure:
        control._command(['exec', CONTAINER_ID], input_data=b'synthetic-secret')
    assert 'synthetic-secret' not in str(failure.value)
    assert failure.value.code == 'DOCKER_COMMAND_FAILED'
    assert failure.value.exit_code == 1
    assert 'synthetic-secret' not in repr(run.call_args.args)
    assert run.call_args.kwargs['shell'] is False
    assert run.call_args.kwargs['timeout'] == 10


def test_create_command_uses_correct_argument_slice(monkeypatch):
    control = adapter.DockerPostgresAdapter()
    control.expected_image_id = IMAGE_ID
    command = Mock(return_value=(CONTAINER_ID + '\n').encode())
    monkeypatch.setattr(control, '_command', command)
    monkeypatch.setattr(control, '_inspect', Mock())
    control.create(adapter._SMOKE_AUTHORIZATION)
    args = command.call_args.args[0]
    assert args[:3] == ['create', '--pull', 'never']
    assert args == control.plan.create_arguments()[3:]
    assert control.container_id == CONTAINER_ID


@pytest.mark.parametrize(('method', 'code', 'stage'), [
    ('preflight', 'PREFLIGHT_FAILED', 'preflight'),
    ('preflight', 'IMAGE_VALIDATION_FAILED', 'preflight'),
    ('preflight', 'PORT_UNAVAILABLE', 'preflight'),
    ('create', 'CONTAINER_CREATE_FAILED', 'container_create'),
    ('create', 'INVALID_CONTAINER_ID', 'container_create'),
    ('create', 'CONTAINER_INSPECTION_FAILED', 'container_create'),
    ('start', 'CONTAINER_START_FAILED', 'container_start'),
    ('start', 'BOOTSTRAP_INPUT_FAILED', 'container_start'),
    ('wait_ready', 'READINESS_TIMEOUT', 'readiness'),
    ('cluster_identity', 'POSTGRES_AUTHENTICATION_FAILED', 'postgres_identity'),
    ('cluster_identity', 'CLUSTER_IDENTITY_MISMATCH', 'postgres_identity'),
    ('remove_bootstrap_file', 'BOOTSTRAP_CLEANUP_FAILED', 'bootstrap_cleanup'),
    ('stop_and_remove', 'CONTAINER_STOP_FAILED', 'container_stop_remove'),
    ('stop_and_remove', 'CONTAINER_REMOVE_FAILED', 'container_stop_remove'),
])
def test_sanitized_report_identifies_failure_stage(monkeypatch, capsys, method, code, stage):
    control = adapter.DockerPostgresAdapter()
    for name in ('preflight', 'create', 'start', 'wait_ready', 'cluster_identity', 'remove_bootstrap_file', 'stop_and_remove'):
        monkeypatch.setattr(control, name, Mock())
    getattr(control, method).side_effect = adapter.DockerSafetyError('synthetic-secret', code=code, exit_code=42)
    monkeypatch.setattr(smoke, 'DockerPostgresAdapter', lambda: control)
    assert smoke.main(['--execute', '--confirm-disposable']) == 1
    output = capsys.readouterr().out
    report = json.loads(output)
    assert report['status'] == 'failed'
    assert report['stage'] == stage
    assert report['error_code'] == code
    assert report['exit_code'] == 42
    assert report['container_id'] is None
    assert 'synthetic-secret' not in output
    assert control.plan.bootstrap_password not in output
    assert control.plan.ownership_token not in output


def test_unknown_create_result_is_not_reported_as_absent(monkeypatch, capsys):
    control = adapter.DockerPostgresAdapter()
    monkeypatch.setattr(control, 'inspect_environment', Mock(return_value=IMAGE_ID))
    monkeypatch.setattr(adapter, 'check_port_available', Mock())
    monkeypatch.setattr(control, '_command', Mock(return_value=b'invalid-id'))
    monkeypatch.setattr(smoke, 'DockerPostgresAdapter', lambda: control)
    assert smoke.main(['--execute', '--confirm-disposable']) == 1
    report = json.loads(capsys.readouterr().out)
    assert report['error_code'] == 'INVALID_CONTAINER_ID'
    assert report['container_id'] is None
    assert report['resource_state'] == 'creation_outcome_unknown'
    assert report['cleanup'] == 'not_attempted'


def test_unexpected_error_is_sanitized(monkeypatch, capsys):
    control = adapter.DockerPostgresAdapter()
    monkeypatch.setattr(control, 'preflight', Mock(side_effect=RuntimeError('synthetic-secret')))
    monkeypatch.setattr(smoke, 'DockerPostgresAdapter', lambda: control)
    assert smoke.main(['--execute', '--confirm-disposable']) == 1
    output = capsys.readouterr().out
    assert json.loads(output)['error_code'] == 'UNEXPECTED_ERROR'
    assert 'synthetic-secret' not in output


def test_authentication_error_and_identity_mismatch_are_distinguished(monkeypatch):
    control, _, connect = simulated_controller(monkeypatch)
    class InvalidPassword(Exception):
        sqlstate = '28P01'
    connect.side_effect = InvalidPassword('synthetic-password')
    with pytest.raises(adapter.DockerSafetyError) as failure:
        smoke.run_smoke(control)
    assert failure.value.code == 'POSTGRES_AUTHENTICATION_FAILED'
    assert 'synthetic-password' not in str(failure.value)

    control, _, _ = simulated_controller(monkeypatch, external_id='987654321')
    with pytest.raises(adapter.DockerSafetyError) as failure:
        smoke.run_smoke(control)
    assert failure.value.code == 'CLUSTER_IDENTITY_MISMATCH'


def test_attach_input_failure_preserves_container(monkeypatch):
    control, state, _ = simulated_controller(monkeypatch)
    monkeypatch.setattr(adapter.subprocess, 'Popen', Mock(side_effect=OSError('synthetic-secret')))
    with pytest.raises(adapter.DockerSafetyError) as failure:
        smoke.run_smoke(control)
    assert failure.value.code == 'BOOTSTRAP_INPUT_FAILED'
    assert control.resource_state == 'start_outcome_unknown'
    assert not any(args[0] in {'stop', 'rm'} for args in state['commands'])


def test_attach_exit_timeout_preserves_stopped_container(monkeypatch):
    control, state, _ = simulated_controller(monkeypatch)
    attach = MagicMock()
    attach.wait.side_effect = subprocess.TimeoutExpired('docker', 5)
    def attached_start(*args, **kwargs):
        state['value'] = 'running'
        return attach
    monkeypatch.setattr(adapter.subprocess, 'Popen', Mock(side_effect=attached_start))
    with pytest.raises(adapter.DockerSafetyError) as failure:
        smoke.run_smoke(control)
    assert failure.value.code == 'CONTAINER_STOP_FAILED'
    assert control.resource_state == 'stopped_verified'
    assert any(args[0] == 'stop' for args in state['commands'])
    assert not any(args[0] == 'rm' for args in state['commands'])


def test_start_attaches_before_sending_password(monkeypatch):
    control, _, _ = simulated_controller(monkeypatch)
    control.expected_image_id = IMAGE_ID
    control.container_id = CONTAINER_ID
    process = MagicMock()
    popen = Mock(return_value=process)
    monkeypatch.setattr(adapter.subprocess, 'Popen', popen)
    write = Mock(wraps=adapter.os.write)
    monkeypatch.setattr(adapter.os, 'write', write)
    control.start(adapter._SMOKE_AUTHORIZATION)
    assert popen.call_args.args[0][-4:] == ['start', '-a', '-i', CONTAINER_ID]
    assert write.call_count == 1
    assert write.call_args.args[1] == (control.plan.bootstrap_password + '\n').encode()
    assert control.plan.bootstrap_password not in repr(popen.call_args)
    assert control.resource_state == 'running_unverified'


def test_bootstrap_input_would_block_preserves_resource(monkeypatch):
    control, state, _ = simulated_controller(monkeypatch)
    monkeypatch.setattr(adapter.os, 'write', Mock(side_effect=BlockingIOError()))
    with pytest.raises(adapter.DockerSafetyError) as error:
        smoke.run_smoke(control)
    assert error.value.code == 'BOOTSTRAP_INPUT_FAILED'
    assert control.resource_state == 'start_outcome_unknown'
    assert not any(args[0] in {'stop', 'rm'} for args in state['commands'])


def test_exited_bootstrap_requires_verified_identity(monkeypatch):
    control, state, _ = simulated_controller(monkeypatch)
    control.container_id, control.expected_image_id, control.stage = CONTAINER_ID, IMAGE_ID, 'readiness'
    details = inspection(control.plan, 'exited')
    details['State']['ExitCode'] = 17
    monkeypatch.setattr(adapter, '_read_docker', Mock(return_value=[details]))
    monkeypatch.setattr(control, '_bootstrap_marker', Mock(return_value='TMPFS_VERIFIED'))
    with pytest.raises(adapter.DockerSafetyError) as error:
        control._inspect('running')
    assert error.value.code == 'CONTAINER_EXITED_DURING_BOOTSTRAP'
    assert error.value.exit_code == 17
    assert control.resource_state == 'exited_verified'
    assert control.bootstrap_marker == 'TMPFS_VERIFIED'
    details['Config']['Labels'][adapter.TOKEN_LABEL] = 'wrong'
    with pytest.raises(adapter.DockerSafetyError) as error:
        control._inspect('running')
    assert error.value.code == 'CONTAINER_INSPECTION_FAILED'
    assert not any(args[0] in {'stop', 'rm'} for args in state['commands'])


def test_bootstrap_layout_and_marker_sanitization(monkeypatch):
    script = adapter.BOOTSTRAP
    assert script.index('stat -f -c %T /var/lib/postgresql') < script.index('> /var/lib/postgresql/.bootstrap-password')
    assert '/var/lib/postgresql/18 /var/lib/postgresql/18/docker' in script
    assert 'id -u postgres' in script and 'id -g postgres' in script
    assert 'test ! -L' in script and 'chmod 0600' in script
    for marker in adapter.BOOTSTRAP_MARKERS:
        assert marker in script
    control = adapter.DockerPostgresAdapter()
    control.container_id = CONTAINER_ID
    result = subprocess.CompletedProcess([], 0, stdout='TMPFS_VERIFIED\nsecret TMPFS_VERIFIED\n', stderr='synthetic-secret')
    monkeypatch.setattr(adapter.subprocess, 'run', Mock(return_value=result))
    assert control._bootstrap_marker() == 'TMPFS_VERIFIED'


def test_readiness_deadline_limits_subprocess_timeout(monkeypatch):
    control = adapter.DockerPostgresAdapter()
    control._readiness_deadline = 100.0
    monkeypatch.setattr(control, '_check_context', Mock())
    monkeypatch.setattr(adapter.time, 'monotonic', Mock(return_value=99.75))
    run = Mock(return_value=subprocess.CompletedProcess([], 0, stdout=b'', stderr=b''))
    monkeypatch.setattr(adapter.subprocess, 'run', run)
    control._command(['exec', CONTAINER_ID], timeout=3)
    assert run.call_args.kwargs['timeout'] == 0.25
    monkeypatch.setattr(adapter.time, 'monotonic', Mock(return_value=100.0))
    with pytest.raises(adapter.DockerSafetyError) as failure:
        control._command(['exec', CONTAINER_ID], timeout=3)
    assert failure.value.code == 'READINESS_TIMEOUT'
    assert run.call_count == 1
