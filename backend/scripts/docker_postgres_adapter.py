"""Disposable PostgreSQL smoke-test controller. Never used by test fixtures."""

from dataclasses import dataclass, field
import json
import os
import re
import secrets
import socket
import subprocess
import time
import ipaddress
from uuid import UUID, uuid4


IMAGE = 'docker.io/library/postgres@sha256:64c8b0d31e4ab6ea665e8426ea406a94bf52de3c05b3a4a8bf713704eefa9328'
ENDPOINT = 'npipe:////./pipe/dockerDesktopLinuxEngine'
OWNER_LABEL = 'com.focusstore.disposable.owner'
RUN_LABEL = 'com.focusstore.disposable.run'
TOKEN_LABEL = 'com.focusstore.disposable.token'
OWNER = 'focusstore-postgres-test'
PORT = 55432
DATA_MOUNT = '/var/lib/postgresql'
PGDATA = '/var/lib/postgresql/18/docker'
TMPFS_OPTIONS = 'rw,nosuid,nodev,mode=0700'
DOCKER_EXE = r'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
BOOTSTRAP_MARKERS = ('BOOTSTRAP_STARTED', 'TMPFS_VERIFIED', 'DATA_DIRECTORY_PREPARED',
                     'PASSWORD_FILE_PREPARED', 'ENTRYPOINT_STARTED')
BOOTSTRAP = '''set -eu
umask 077
printf '%s\\n' BOOTSTRAP_STARTED
IFS= read -r bootstrap_password
test -n "$bootstrap_password"
test "$(id -u)" = 0
for p in /var /var/lib /var/lib/postgresql; do test ! -L "$p"; done
test "$(realpath /var/lib/postgresql)" = /var/lib/postgresql
test "$(stat -f -c %T /var/lib/postgresql)" = tmpfs
printf '%s\\n' TMPFS_VERIFIED
for p in /var/lib/postgresql/18 /var/lib/postgresql/18/docker; do test ! -L "$p"; done
install -d -m 0700 -o postgres -g postgres /var/lib/postgresql /var/lib/postgresql/18 /var/lib/postgresql/18/docker
for p in /var/lib/postgresql /var/lib/postgresql/18 /var/lib/postgresql/18/docker; do
  test "$(realpath "$p")" = "$p"
  test "$(stat -f -c %T "$p")" = tmpfs
  test "$(stat -c %u:%g:%a "$p")" = "$(id -u postgres):$(id -g postgres):700"
done
printf '%s\\n' DATA_DIRECTORY_PREPARED
test ! -e /var/lib/postgresql/.bootstrap-password
test ! -L /var/lib/postgresql/.bootstrap-password
printf '%s' "$bootstrap_password" > /var/lib/postgresql/.bootstrap-password
unset bootstrap_password
chown postgres:postgres /var/lib/postgresql/.bootstrap-password
chmod 0600 /var/lib/postgresql/.bootstrap-password
test "$(stat -c %u:%g:%a /var/lib/postgresql/.bootstrap-password)" = "$(id -u postgres):$(id -g postgres):600"
printf '%s\\n' PASSWORD_FILE_PREPARED
export POSTGRES_PASSWORD_FILE=/var/lib/postgresql/.bootstrap-password
printf '%s\\n' ENTRYPOINT_STARTED
exec /usr/local/bin/docker-entrypoint.sh postgres'''


class DockerSafetyError(RuntimeError):
    def __init__(self, message: str, *, code: str | None = None, exit_code: int | None = None):
        super().__init__(message)
        self.code = code
        self.exit_code = exit_code


def _docker_environment() -> dict[str, str]:
    return {key: os.environ[key] for key in ('SYSTEMROOT', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP') if key in os.environ}


def _read_docker(*args: str, timeout: float = 10) -> object:
    """Execute a fixed read-only inspection without shell or inherited output."""
    allowed = (
        ('context', 'show'),
        ('context', 'inspect', 'desktop-linux'),
        ('--context', 'desktop-linux', 'version', '--format', '{{json .Server}}'),
        ('--context', 'desktop-linux', 'image', 'inspect', IMAGE),
    )
    is_inspect = (len(args) == 4 and args[:3] == ('--context', 'desktop-linux', 'inspect')
                  and re.fullmatch(r'[0-9a-f]{64}', args[3]))
    if args not in allowed and not is_inspect:
        raise DockerSafetyError('Docker command is not an approved read-only inspection.')
    try:
        result = subprocess.run([DOCKER_EXE, *args], shell=False, capture_output=True, text=True,
                                timeout=timeout, check=True, stdin=subprocess.DEVNULL, env=_docker_environment())
        if args == ('context', 'show'):
            return result.stdout.strip()
        return json.loads(result.stdout)
    except subprocess.CalledProcessError as error:
        raise DockerSafetyError('Docker inspection failed.', code='DOCKER_COMMAND_FAILED', exit_code=error.returncode) from None
    except (OSError, subprocess.SubprocessError, ValueError):
        raise DockerSafetyError('Docker inspection failed or timed out.') from None


def check_environment_overrides(environment: dict) -> None:
    if any(environment.get(key) for key in ('DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH')):
        raise DockerSafetyError('Docker environment overrides are not permitted.', code='DOCKER_ENV_CONFLICT')


def check_context(context: str, metadata: list, environment: dict) -> None:
    check_environment_overrides(environment)
    try:
        endpoint = metadata[0]['Endpoints']['docker']['Host']
        name = metadata[0]['Name']
    except (KeyError, IndexError, TypeError):
        raise DockerSafetyError('Docker context metadata is invalid.', code='DOCKER_ENDPOINT_MISMATCH') from None
    if context != 'desktop-linux' or name != context:
        raise DockerSafetyError('Unexpected Docker context.', code='DOCKER_CONTEXT_MISMATCH')
    if endpoint != ENDPOINT:
        raise DockerSafetyError('Unexpected Docker endpoint.', code='DOCKER_ENDPOINT_MISMATCH')


def check_environment(context: str, metadata: list, server: dict, environment: dict) -> None:
    check_context(context, metadata, environment)
    if not isinstance(server, dict) or server.get('Os') != 'linux' or server.get('Arch') not in {'amd64', 'arm64'}:
        raise DockerSafetyError('Unexpected Docker server platform.')


def image_id(image: list, *, expected_architecture: str | None = None) -> str:
    try:
        details = image[0]
        identifier = details['Id']
        digests = details['RepoDigests']
        platform = details['Os'], details['Architecture']
        config = details['Config']
        volumes = config['Volumes']
        entries = config['Env']
        environment = dict(entry.split('=', 1) for entry in entries)
    except (KeyError, IndexError, TypeError, ValueError):
        raise DockerSafetyError('Docker image metadata is invalid.') from None
    accepted = {IMAGE, IMAGE.replace('docker.io/library/', ''), IMAGE.replace('docker.io/', '')}
    if (not isinstance(digests, list) or not accepted.intersection(digests) or not isinstance(identifier, str)
            or not re.fullmatch(r'sha256:[0-9a-f]{64}', identifier)
            or platform[0] != 'linux' or platform[1] not in {'amd64', 'arm64'}
            or (expected_architecture is not None and platform[1] != expected_architecture)
            or len(environment) != len(entries)
            or not isinstance(volumes, dict) or set(volumes) != {DATA_MOUNT}
            or environment.get('PGDATA') != PGDATA):
        raise DockerSafetyError('Docker image identity or platform is invalid.')
    return identifier


def check_port_available() -> None:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
            if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
                listener.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            listener.bind(('127.0.0.1', PORT))
    except OSError:
        raise DockerSafetyError('The reserved PostgreSQL test port is unavailable.') from None


@dataclass(frozen=True)
class RunPlan:
    run_id: UUID = field(default_factory=uuid4)
    bootstrap_password: str = field(default_factory=lambda: secrets.token_urlsafe(32), repr=False)
    application_password: str = field(default_factory=lambda: secrets.token_urlsafe(32), repr=False)
    ownership_token: str = field(default_factory=lambda: secrets.token_hex(32), repr=False)

    @property
    def name(self) -> str:
        return f'focusstore-test-{self.run_id.hex}'

    @property
    def labels(self) -> dict[str, str]:
        return {OWNER_LABEL: OWNER, RUN_LABEL: str(self.run_id), TOKEN_LABEL: self.ownership_token}

    def create_arguments(self) -> list[str]:
        """Return a reviewable plan; this method does not run Docker."""
        return [
            'docker', '--context', 'desktop-linux', 'create', '--pull', 'never', '--interactive',
            '--name', self.name, '--label', f'{OWNER_LABEL}={OWNER}',
            '--label', f'{RUN_LABEL}={self.run_id}', '--network', 'bridge',
            '--label', f'{TOKEN_LABEL}={self.ownership_token}',
            '--publish', f'127.0.0.1:{PORT}:5432', '--tmpfs', f'{DATA_MOUNT}:{TMPFS_OPTIONS}',
            '--env', 'POSTGRES_USER=focusstore_bootstrap',
            '--env', 'POSTGRES_DB=focusstore_integration_test',
            '--env', 'POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256 --auth-local=scram-sha-256',
            '--env', 'POSTGRES_HOST_AUTH_METHOD=scram-sha-256',
            '--entrypoint', '/bin/sh', IMAGE, '-c', BOOTSTRAP,
        ]


def validate_container(details: dict, plan: RunPlan, expected_image_id: str, expected_container_id: str,
                       *, expected_state: str) -> str:
    """Check a full inspect result before any future operation on its ID."""
    try:
        identifier = details['Id']
        config, host, state = details['Config'], details['HostConfig'], details['State']
        mounts = details['Mounts']
        ports = host['PortBindings']
        networks = details['NetworkSettings']['Networks']
        tmpfs = host['Tmpfs']
        valid_id = isinstance(identifier, str) and bool(re.fullmatch(r'[0-9a-f]{64}', identifier))
        active_ports = details['NetworkSettings']['Ports']
        entries = config['Env']
        environment = dict(entry.split('=', 1) for entry in entries)
        allowed_environment = {'PATH', 'GOSU_VERSION', 'LANG', 'PG_MAJOR', 'PG_VERSION', 'PG_SHA256',
                               'PGDATA', 'POSTGRES_USER', 'POSTGRES_DB', 'POSTGRES_INITDB_ARGS', 'POSTGRES_HOST_AUTH_METHOD'}
        expected_ports = {'5432/tcp': [{'HostIp': '127.0.0.1', 'HostPort': str(PORT)}]}
        network_names = set(networks)
        valid_networks = (network_names == {'bridge'} if expected_state == 'running'
                          else network_names in (set(), {'bridge'}))
        valid = (expected_state in {'created', 'running', 'exited'} and valid_id
                 and identifier == expected_container_id and details['Name'] == '/' + plan.name
                 and details['Image'] == expected_image_id and config['Image'] == IMAGE
                 and config['Entrypoint'] == ['/bin/sh'] and config['Cmd'] == ['-c', BOOTSTRAP]
                 and config['OpenStdin'] is True and config['Tty'] is False and config.get('User') in ('', 'root')
                 and len(environment) == len(entries) and set(environment) <= allowed_environment
                 and environment.get('POSTGRES_USER') == 'focusstore_bootstrap'
                 and environment.get('POSTGRES_DB') == 'focusstore_integration_test'
                 and environment.get('POSTGRES_INITDB_ARGS') == '--auth-host=scram-sha-256 --auth-local=scram-sha-256'
                 and environment.get('POSTGRES_HOST_AUTH_METHOD') == 'scram-sha-256'
                 and environment.get('PGDATA') == PGDATA
                 and config['Labels'] == plan.labels and state['Status'] == expected_state
                 and ports == expected_ports
                 and (expected_state != 'running' or active_ports == expected_ports)
                 and host['NetworkMode'] == 'bridge' and valid_networks
                 and not host['Privileged'] and not host.get('Binds') and not host.get('Devices')
                 and not host.get('CapAdd') and not host.get('VolumesFrom') and not host.get('SecurityOpt')
                 and not host.get('DeviceRequests') and host.get('CgroupnsMode') != 'host'
                 and not host.get('PidMode') and host.get('IpcMode') in ('', 'private')
                 and not host.get('UTSMode') and not host.get('UsernsMode')
                 and not host.get('PublishAllPorts') and not host.get('ExtraHosts')
                 and host.get('RestartPolicy', {}).get('Name') in ('', 'no')
                 and tmpfs == {DATA_MOUNT: TMPFS_OPTIONS}
                 and all(mount.get('Type') == 'tmpfs' and mount.get('Destination') == DATA_MOUNT for mount in mounts))
    except (KeyError, TypeError, ValueError, AttributeError):
        raise DockerSafetyError('Container inspection is incomplete.') from None
    if not valid:
        raise DockerSafetyError('Container identity or isolation is invalid.')
    return identifier


def validate_cluster_identifier(value: str, expected: str) -> None:
    """Compare an independently recorded identifier; no database is contacted."""
    if (not isinstance(value, str) or not re.fullmatch(r'[1-9][0-9]{0,19}', value)
            or int(value) > 2**64 - 1 or value != expected):
        raise DockerSafetyError('PostgreSQL cluster identity is invalid.')


_SMOKE_AUTHORIZATION = object()
DATABASE = 'focusstore_integration_test'
USER = 'focusstore_bootstrap'
IDENTITY_SQL = ("SELECT json_build_object('system_identifier',system_identifier::text,"
                "'database',current_database(),'user',current_user,'session_user',session_user,"
                "'port',inet_server_port(),'address',inet_server_addr()::text,"
                "'data_directory',current_setting('data_directory'))::text FROM pg_control_system()")


class DockerPostgresAdapter:
    """Run only the explicitly authorized smoke test; fixtures remain separate."""

    def __init__(self) -> None:
        self.plan = RunPlan()
        self.container_id = None
        self.expected_image_id = None
        self.cluster_id = None
        self._attach = None
        self._readiness_deadline = None
        self.create_attempted = False
        self.resource_state = 'not_created'
        self.cleanup_state = 'not_attempted'
        self.stage = 'not_started'
        self.bootstrap_marker = None

    def inspect_environment(self) -> str:
        environment = dict(os.environ)
        check_environment_overrides(environment)
        try:
            context = _read_docker('context', 'show')
            if context != 'desktop-linux':
                raise DockerSafetyError('Unexpected Docker context.', code='DOCKER_CONTEXT_MISMATCH')
            metadata = _read_docker('context', 'inspect', 'desktop-linux')
        except DockerSafetyError as error:
            if error.code == 'DOCKER_CONTEXT_MISMATCH':
                raise
            raise DockerSafetyError('Docker inspection unavailable.', code='DOCKER_UNAVAILABLE', exit_code=error.exit_code) from None
        check_context(context, metadata, environment)
        try:
            server = _read_docker('--context', 'desktop-linux', 'version', '--format', '{{json .Server}}')
        except DockerSafetyError as error:
            raise DockerSafetyError('Docker unavailable.', code='DOCKER_UNAVAILABLE', exit_code=error.exit_code) from None
        check_environment(context, metadata, server, environment)
        try:
            return image_id(_read_docker('--context', 'desktop-linux', 'image', 'inspect', IMAGE),
                            expected_architecture=server['Arch'])
        except DockerSafetyError as error:
            raise DockerSafetyError('Image verification failed.', code='IMAGE_VALIDATION_FAILED', exit_code=error.exit_code) from None

    def _require(self, authorization: object) -> None:
        if authorization is not _SMOKE_AUTHORIZATION:
            raise DockerSafetyError('Explicit smoke-test authorization is required.')

    def _check_context(self) -> None:
        environment = dict(os.environ)
        check_environment_overrides(environment)
        check_context(_read_docker('context', 'show', timeout=self._remaining(10)),
                      _read_docker('context', 'inspect', 'desktop-linux', timeout=self._remaining(10)), environment)

    def _remaining(self, limit: float) -> float:
        if self._readiness_deadline is None:
            return limit
        remaining = self._readiness_deadline - time.monotonic()
        if remaining <= 0:
            raise DockerSafetyError('PostgreSQL readiness timed out.', code='READINESS_TIMEOUT')
        return min(limit, remaining)

    def _command(self, args: list[str], *, input_data: bytes | None = None, timeout: int = 10) -> bytes:
        self._check_context()
        try:
            result = subprocess.run([DOCKER_EXE, '--context', 'desktop-linux', *args], input=input_data,
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=False,
                                    timeout=self._remaining(timeout), check=True, env=_docker_environment())
            return result.stdout
        except subprocess.CalledProcessError as error:
            raise DockerSafetyError('Docker command failed.', code='DOCKER_COMMAND_FAILED', exit_code=error.returncode) from None
        except (OSError, subprocess.SubprocessError):
            raise DockerSafetyError('Docker operation failed or timed out.') from None

    def _inspect(self, state: str) -> dict:
        if not self.container_id or not self.expected_image_id:
            raise DockerSafetyError('Container identity is unavailable.')
        self._check_context()
        try:
            data = _read_docker('--context', 'desktop-linux', 'inspect', self.container_id, timeout=self._remaining(10))
            if not isinstance(data, list) or len(data) != 1:
                raise DockerSafetyError('Container inspection is invalid.')
            if state == 'running' and self.stage == 'readiness' and data[0].get('State', {}).get('Status') == 'exited':
                validate_container(data[0], self.plan, self.expected_image_id, self.container_id, expected_state='exited')
                exit_code = data[0]['State'].get('ExitCode')
                if type(exit_code) is not int:
                    raise DockerSafetyError('Container exit status is invalid.')
                self.resource_state = 'exited_verified'
                self.bootstrap_marker = self._bootstrap_marker()
                raise DockerSafetyError('Container exited during bootstrap.', code='CONTAINER_EXITED_DURING_BOOTSTRAP', exit_code=exit_code)
            validate_container(data[0], self.plan, self.expected_image_id, self.container_id, expected_state=state)
        except DockerSafetyError as error:
            if error.code in {'READINESS_TIMEOUT', 'CONTAINER_EXITED_DURING_BOOTSTRAP'}:
                raise
            raise DockerSafetyError('Container inspection failed.', code='CONTAINER_INSPECTION_FAILED', exit_code=error.exit_code) from None
        return data[0]

    def _bootstrap_marker(self) -> str | None:
        """Read only fixed markers after container identity has been verified."""
        try:
            result = subprocess.run([DOCKER_EXE, '--context', 'desktop-linux', 'logs', '--tail', '20', self.container_id],
                                    shell=False, capture_output=True, text=True, timeout=self._remaining(3),
                                    check=True, stdin=subprocess.DEVNULL, env=_docker_environment())
            found = set((result.stdout + '\n' + result.stderr).splitlines())
            return next((marker for marker in reversed(BOOTSTRAP_MARKERS) if marker in found), None)
        except (OSError, subprocess.SubprocessError, DockerSafetyError):
            return None

    def preflight(self, authorization: object) -> None:
        self._require(authorization)
        if self.container_id is not None or self.expected_image_id is not None:
            raise DockerSafetyError('This smoke-test controller cannot be reused.')
        verified_image_id = self.inspect_environment()
        try:
            check_port_available()
        except DockerSafetyError:
            raise DockerSafetyError('Reserved port unavailable.', code='PORT_UNAVAILABLE') from None
        self.expected_image_id = verified_image_id

    def create(self, authorization: object = None) -> None:
        self._require(authorization)
        if not self.expected_image_id or self.container_id:
            raise DockerSafetyError('Preflight is required for exactly one container.')
        command = self.plan.create_arguments()
        self.create_attempted = True
        self.resource_state = 'creation_outcome_unknown'
        result = self._command(command[3:], timeout=30).decode('ascii', errors='replace').strip()
        if not re.fullmatch(r'[0-9a-f]{64}', result):
            raise DockerSafetyError('Docker did not return a full container ID; investigate manually.', code='INVALID_CONTAINER_ID')
        self.container_id = result
        self.resource_state = 'id_recorded_unverified'
        self._inspect('created')
        self.resource_state = 'created_verified'

    def start(self, authorization: object = None) -> None:
        self._require(authorization)
        self._inspect('created')
        self.resource_state = 'start_outcome_unknown'
        read_fd = write_fd = None
        try:
            self._check_context()
            payload = (self.plan.bootstrap_password + '\n').encode('ascii')
            if len(payload) > 128:
                raise ValueError('Bootstrap input is too long.')
            read_fd, write_fd = os.pipe()
            os.set_blocking(write_fd, False)
            if os.write(write_fd, payload) != len(payload):
                raise OSError('Incomplete bootstrap input.')
            os.close(write_fd)
            write_fd = None
            self._attach = subprocess.Popen([DOCKER_EXE, '--context', 'desktop-linux', 'start', '-a', '-i', self.container_id],
                                            shell=False, stdin=read_fd, stdout=subprocess.DEVNULL,
                                            stderr=subprocess.DEVNULL, env=_docker_environment())
        except (OSError, ValueError, subprocess.SubprocessError):
            raise DockerSafetyError('Unable to provide bootstrap input; preserve container.',
                                   code='BOOTSTRAP_INPUT_FAILED') from None
        finally:
            if write_fd is not None:
                os.close(write_fd)
            if read_fd is not None:
                os.close(read_fd)
        self.resource_state = 'running_unverified'

    def wait_ready(self, authorization: object, *, timeout: float = 45) -> None:
        self._require(authorization)
        deadline = time.monotonic() + min(max(timeout, 1), 60)
        self._readiness_deadline = deadline
        try:
            while True:
                self._remaining(10)
                self._inspect('running')
                self.resource_state = 'running_verified'
                try:
                    self._command(['exec', '--user', 'postgres', self.container_id, 'pg_isready',
                                   '-h', '127.0.0.1', '-p', '5432', '-U', USER, '-d', DATABASE], timeout=3)
                    self._remaining(10)
                    return
                except DockerSafetyError as error:
                    if error.code != 'DOCKER_COMMAND_FAILED' or error.exit_code not in {1, 2}:
                        raise
                    time.sleep(self._remaining(0.5))
        finally:
            self._readiness_deadline = None

    def cluster_identity(self, authorization: object = None) -> None:
        self._require(authorization)
        if any(key.upper().startswith('PG') and value for key, value in os.environ.items()):
            raise DockerSafetyError('Conflicting PostgreSQL environment; preserve container.')
        details = self._inspect('running')
        script = ('set -eu; test "$(stat -f -c %T ' + PGDATA + ')" = tmpfs; '
                  'test "$(realpath ' + PGDATA + ')" = ' + PGDATA + '; '
                  'IFS= read -r PGPASSWORD; export PGPASSWORD; '
                  'PGOPTIONS="-c statement_timeout=5000 -c lock_timeout=2000"; export PGOPTIONS; '
                  'exec psql -X -q -t -A -h 127.0.0.1 -p 5432 -U ' + USER + ' -d ' + DATABASE + ' -c "$1"')
        raw = self._command(['exec', '-i', '--user', 'postgres', self.container_id, '/bin/sh', '-c', script, 'sh', IDENTITY_SQL],
                            input_data=(self.plan.bootstrap_password + '\n').encode())
        try:
            internal = json.loads(raw)
            address = details['NetworkSettings']['Networks']['bridge']['IPAddress']
            if not ipaddress.ip_address(address).is_private:
                raise ValueError('unexpected address')
        except Exception:
            raise DockerSafetyError('Internal identity invalid.', code='CLUSTER_IDENTITY_MISMATCH') from None
        try:
            import psycopg
            with psycopg.connect(host='127.0.0.1', hostaddr='127.0.0.1', port=PORT, dbname=DATABASE,
                                 user=USER, password=self.plan.bootstrap_password, connect_timeout=3,
                                 sslmode='disable', options='-c statement_timeout=5000 -c lock_timeout=2000') as connection:
                with connection.cursor() as cursor:
                    cursor.execute(IDENTITY_SQL)
                    external = json.loads(cursor.fetchone()[0])
        except Exception as error:
            code = 'POSTGRES_AUTHENTICATION_FAILED' if getattr(error, 'sqlstate', None) in {'28P01', '28000'} else 'POSTGRES_CONNECTION_FAILED'
            raise DockerSafetyError('PostgreSQL connection failed.', code=code) from None
        try:
            validate_cluster_identifier(internal['system_identifier'], external['system_identifier'])
            if self.cluster_id is not None:
                validate_cluster_identifier(internal['system_identifier'], self.cluster_id)
            for identity in (internal, external):
                if (identity['database'] != DATABASE or identity['user'] != USER or identity['session_user'] != USER
                        or identity['port'] != 5432 or identity['data_directory'] != PGDATA):
                    raise ValueError('unexpected identity')
            if internal['address'] != '127.0.0.1/32' or external['address'].split('/')[0] != address:
                raise ValueError('unexpected endpoint')
        except Exception:
            raise DockerSafetyError('PostgreSQL identity mismatch.', code='CLUSTER_IDENTITY_MISMATCH') from None
        self.cluster_id = internal['system_identifier']

    def remove_bootstrap_file(self, authorization: object) -> None:
        self._require(authorization)
        if not self.cluster_id:
            raise DockerSafetyError('Cluster identity is required before bootstrap cleanup.')
        self._inspect('running')
        script = ('set -eu; p=/var/lib/postgresql/.bootstrap-password; test -f "$p"; test ! -L "$p"; '
                  'test "$(stat -c %u:%g:%a "$p")" = "$(id -u postgres):$(id -g postgres):600"; '
                  'test "$(stat -f -c %T "$p")" = tmpfs; rm -- "$p"')
        self._command(['exec', '--user', 'root', self.container_id, '/bin/sh', '-c', script])

    def stop_and_remove(self, authorization: object = None) -> None:
        self._require(authorization)
        if not self.cluster_id:
            raise DockerSafetyError('Cluster identity is uncertain; preserve container.')
        self.cluster_identity(authorization)
        self._inspect('running')
        self.stage = 'container_stop'
        self.cleanup_state = 'in_progress'
        self.resource_state = 'stop_outcome_unknown'
        self._command(['stop', '--timeout', '10', self.container_id], timeout=20)
        self._inspect('exited')
        self.resource_state = 'stopped_verified'
        try:
            if self._attach is not None:
                self._attach.wait(timeout=5)
        except (OSError, subprocess.SubprocessError):
            raise DockerSafetyError('Attach process did not terminate; preserve container.') from None
        self.stage = 'container_remove'
        self.resource_state = 'removal_outcome_unknown'
        self._command(['rm', self.container_id])
        self.resource_state = 'removed'
        self.cleanup_state = 'completed'

    def remove(self, container_id: str) -> None:
        raise DockerSafetyError('Use the authorized smoke-test lifecycle; arbitrary removal is disabled.')
