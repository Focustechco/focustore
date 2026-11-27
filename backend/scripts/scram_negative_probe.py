"""Read SQLSTATE from a deliberately invalid SCRAM proof, never credentials."""
import base64
import binascii
import re
import secrets
import socket
import struct
import time

from docker_postgres_adapter import DATABASE, PORT, DockerPostgresAdapter

MAX_FRAME = 16384
TIMEOUT = 5.0


class ProbeError(RuntimeError):
    def __init__(self, reason):
        super().__init__('Authentication probe failed.')
        self.reason = reason


def _recv_exact(sock, length, deadline):
    data = bytearray()
    while len(data) < length:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError
        sock.settimeout(remaining)
        chunk = sock.recv(length - len(data))
        if not chunk:
            raise ProbeError('invalid_response')
        data.extend(chunk)
    return bytes(data)


def _frame(sock, deadline):
    kind = _recv_exact(sock, 1, deadline)
    length = struct.unpack('!I', _recv_exact(sock, 4, deadline))[0]
    if length < 4 or length > MAX_FRAME:
        raise ProbeError('invalid_response')
    return kind, _recv_exact(sock, length - 4, deadline)


def _send(sock, payload, deadline):
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError
    sock.settimeout(remaining)
    sock.sendall(payload)


def _message(kind, payload):
    return kind + struct.pack('!I', len(payload) + 4) + payload


def _sqlstate(payload):
    if not payload.endswith(b'\x00\x00'):
        raise ProbeError('invalid_response')
    fields = payload[:-1].split(b'\x00')
    codes = [x[1:] for x in fields if x.startswith(b'C')]
    if len(codes) != 1 or not re.fullmatch(rb'[0-9A-Z]{5}', codes[0]):
        raise ProbeError('invalid_response')
    return codes[0].decode('ascii')


def probe(controller, authorization, role):
    """Return only a classification; never relay the backend error message."""
    if not isinstance(controller, DockerPostgresAdapter) or role not in {'focusstore_migrator', 'focusstore_test'}:
        raise ProbeError('identity_failed')
    try:
        controller._require(authorization)
        if not controller.cluster_id or not controller.container_id or not controller.expected_image_id:
            raise ProbeError('identity_failed')
        controller.cluster_identity(authorization)
        controller._inspect('running')
        deadline = time.monotonic() + TIMEOUT
        with socket.create_connection(('127.0.0.1', PORT), timeout=TIMEOUT) as sock:
            if sock.getpeername()[:2] != ('127.0.0.1', PORT):
                raise ProbeError('identity_failed')
            startup = struct.pack('!I', 196608) + b'user\x00' + role.encode('ascii') + b'\x00database\x00' + DATABASE.encode('ascii') + b'\x00\x00'
            _send(sock, struct.pack('!I', len(startup) + 4) + startup, deadline)
            kind, data = _frame(sock, deadline)
            if kind != b'R' or len(data) < 6 or struct.unpack('!I', data[:4])[0] != 10:
                raise ProbeError('invalid_response')
            if b'SCRAM-SHA-256' not in data[4:].split(b'\x00') or not data.endswith(b'\x00\x00'):
                raise ProbeError('invalid_response')
            nonce = secrets.token_urlsafe(24).encode('ascii')
            first = b'n,,n=,r=' + nonce
            _send(sock, _message(b'p', b'SCRAM-SHA-256\x00' + struct.pack('!I', len(first)) + first), deadline)
            kind, data = _frame(sock, deadline)
            if kind != b'R' or len(data) < 5 or struct.unpack('!I', data[:4])[0] != 11:
                raise ProbeError('invalid_response')
            parts = data[4:].split(b',')
            if len(parts) != 3 or not parts[0].startswith(b'r=') or not parts[1].startswith(b's=') or not parts[2].startswith(b'i='):
                raise ProbeError('invalid_response')
            server_nonce = parts[0][2:]
            if (not server_nonce.startswith(nonce) or len(server_nonce) <= len(nonce)
                    or not re.fullmatch(rb'[!-+\--~]{1,512}', server_nonce)
                    or not re.fullmatch(rb'[0-9]{1,8}', parts[2][2:])):
                raise ProbeError('invalid_response')
            salt = base64.b64decode(parts[1][2:], validate=True)
            if not salt or not 4096 <= int(parts[2][2:]) <= 10000000:
                raise ProbeError('invalid_response')
            # Random bytes are not a calculated SCRAM proof and never contain a password.
            proof = base64.b64encode(secrets.token_bytes(32))
            _send(sock, _message(b'p', b'c=biws,r=' + server_nonce + b',p=' + proof), deadline)
            kind, data = _frame(sock, deadline)
            if kind == b'E':
                state = _sqlstate(data)
                result = 'rejected' if state == '28P01' else 'unexpected_sqlstate'
            elif kind == b'R' and len(data) >= 4 and struct.unpack('!I', data[:4])[0] in {0, 12}:
                result = 'incorrect_proof_accepted'
            else:
                raise ProbeError('invalid_response')
        controller.cluster_identity(authorization)
        controller._inspect('running')
        return result
    except ProbeError:
        raise
    except (TimeoutError, socket.timeout):
        raise ProbeError('timeout') from None
    except (OSError, ConnectionError):
        raise ProbeError('connection_failed') from None
    except (ValueError, UnicodeError, binascii.Error, struct.error):
        raise ProbeError('invalid_response') from None
    except Exception:
        raise ProbeError('identity_failed') from None
