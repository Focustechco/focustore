from pathlib import Path
import socket
import struct
import sys
from unittest.mock import Mock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import docker_postgres_adapter as adapter
import scram_negative_probe as probe


def frame(kind, data):
    return kind + struct.pack('!I', len(data) + 4) + data


class FakeSocket:
    def __init__(self, data, peer=('127.0.0.1', 55432)):
        self.data = bytearray(data)
        self.peer = peer
        self.sent = []
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def getpeername(self): return self.peer
    def settimeout(self, value): pass
    def sendall(self, value): self.sent.append(value)
    def recv(self, length):
        data = bytes(self.data[:length])
        del self.data[:length]
        return data


def setup_probe(monkeypatch, final, *, peer=('127.0.0.1', 55432)):
    controller = adapter.DockerPostgresAdapter()
    controller.container_id, controller.cluster_id, controller.expected_image_id = 'a' * 64, '123', 'sha256:' + 'b' * 64
    monkeypatch.setattr(controller, 'cluster_identity', Mock())
    monkeypatch.setattr(controller, '_inspect', Mock())
    monkeypatch.setattr(probe.secrets, 'token_urlsafe', Mock(return_value='nonce'))
    monkeypatch.setattr(probe.secrets, 'token_bytes', Mock(return_value=b'x' * 32))
    sasl = frame(b'R', struct.pack('!I', 10) + b'SCRAM-SHA-256\x00\x00')
    challenge = frame(b'R', struct.pack('!I', 11) + b'r=nonceSERVER,s=c2FsdA==,i=4096')
    sock = FakeSocket(sasl + challenge + final, peer)
    connect = Mock(return_value=sock)
    monkeypatch.setattr(probe.socket, 'create_connection', connect)
    return controller, sock, connect


def test_same_connection_returns_only_sqlstate(monkeypatch):
    error = frame(b'E', b'SFATAL\x00C28P01\x00Msynthetic-secret\x00\x00')
    controller, sock, connect = setup_probe(monkeypatch, error)
    assert probe.probe(controller, adapter._SMOKE_AUTHORIZATION, 'focusstore_migrator') == 'rejected'
    assert controller.cluster_identity.call_count == 2
    connect.assert_called_once_with(('127.0.0.1', 55432), timeout=5.0)
    assert b'synthetic-secret' not in b''.join(sock.sent)
    assert controller.plan.bootstrap_password.encode() not in b''.join(sock.sent)


def test_acceptance_is_not_mistaken_for_rejection(monkeypatch):
    controller, _, _ = setup_probe(monkeypatch, frame(b'R', struct.pack('!I', 0)))
    assert probe.probe(controller, adapter._SMOKE_AUTHORIZATION, 'focusstore_test') == 'incorrect_proof_accepted'


@pytest.mark.parametrize('final', [b'', frame(b'E', b'C28000\x00\x00'), frame(b'E', b'C28P01\x00C28P01\x00\x00')])
def test_other_or_invalid_response_fails_closed(monkeypatch, final):
    controller, _, _ = setup_probe(monkeypatch, final)
    try:
        result = probe.probe(controller, adapter._SMOKE_AUTHORIZATION, 'focusstore_test')
        assert result == 'unexpected_sqlstate'
    except probe.ProbeError as error:
        assert error.reason == 'invalid_response'


def test_invalid_peer_is_rejected(monkeypatch):
    controller, _, _ = setup_probe(monkeypatch, b'', peer=('127.0.0.1', 5432))
    with pytest.raises(probe.ProbeError) as error:
        probe.probe(controller, adapter._SMOKE_AUTHORIZATION, 'focusstore_test')
    assert error.value.reason == 'identity_failed'


def test_revalidation_failure_does_not_return_rejection(monkeypatch):
    controller, _, _ = setup_probe(monkeypatch, frame(b'E', b'C28P01\x00\x00'))
    controller.cluster_identity.side_effect = [None, RuntimeError('synthetic-secret')]
    with pytest.raises(probe.ProbeError) as error:
        probe.probe(controller, adapter._SMOKE_AUTHORIZATION, 'focusstore_test')
    assert error.value.reason == 'identity_failed'
    assert 'synthetic-secret' not in str(error.value)


@pytest.mark.parametrize(('exc', 'reason'), [(TimeoutError('secret'), 'timeout'), (OSError('secret'), 'connection_failed')])
def test_network_failure_is_sanitized(monkeypatch, exc, reason):
    controller, _, _ = setup_probe(monkeypatch, b'')
    monkeypatch.setattr(probe.socket, 'create_connection', Mock(side_effect=exc))
    with pytest.raises(probe.ProbeError) as error:
        probe.probe(controller, adapter._SMOKE_AUTHORIZATION, 'focusstore_test')
    assert error.value.reason == reason
    assert 'secret' not in str(error.value)
