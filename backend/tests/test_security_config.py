import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.config import Settings, get_settings


@pytest.mark.parametrize('origin', ['*', 'https://user:pass@example.test', 'https://example.test/path',
                                   'https://example.test?query=x', 'https://example.test#x',
                                   'file:///tmp/x', 'http://localhost:bad'])
def test_invalid_cors_origin(origin):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, database_url='sqlite:///:memory:', frontend_origin=origin)


def test_cors_credentials_only_for_explicit_origin(monkeypatch):
    from app.main import create_app
    monkeypatch.setenv('FRONTEND_ORIGIN', 'http://localhost:3000/')
    get_settings.cache_clear()
    with TestClient(create_app()) as client:
        trusted = client.options('/categories', headers={
            'origin': 'http://localhost:3000', 'access-control-request-method': 'POST',
            'access-control-request-headers': 'content-type',
        })
        assert trusted.status_code == 200
        assert trusted.headers['access-control-allow-origin'] == 'http://localhost:3000'
        assert trusted.headers['access-control-allow-credentials'] == 'true'
        denied = client.options('/categories', headers={
            'origin': 'https://evil.test', 'access-control-request-method': 'POST',
        })
        assert denied.status_code == 400
        assert 'access-control-allow-origin' not in denied.headers


def test_no_identity_or_db_details_in_error(client, identity_source):
    identity_source.write_bytes(b'broken secret-password')
    client.cookies.set('focus_session', 'admin-token')
    response = client.get('/api/v1/users/me')
    assert response.status_code == 503
    assert 'secret-password' not in response.text
    assert str(identity_source) not in response.text


def test_own_routes_declare_cookie_security():
    from app.main import app
    schema = app.openapi()
    assert schema['components']['securitySchemes']['APIKeyCookie'] == {
        'type': 'apiKey', 'in': 'cookie', 'name': 'focus_session',
    }
    for path, method in [('/categories', 'post'), ('/products/{product_id}', 'patch'),
                         ('/api/v1/users/me', 'get'), ('/api/v1/orders', 'get')]:
        assert schema['paths'][path][method]['security'] == [{'APIKeyCookie': []}]


def test_trusted_frontend_origin_can_write(admin_client, monkeypatch):
    monkeypatch.setenv('FRONTEND_ORIGIN', 'http://localhost:3000')
    get_settings.cache_clear()
    response = admin_client.post('/categories',
        headers={'origin': 'http://localhost:3000', 'sec-fetch-site': 'same-site'},
        json={'name': 'Trusted', 'slug': 'trusted'})
    assert response.status_code == 201


def test_sql_errors_are_sanitized(admin_client, monkeypatch):
    from sqlalchemy.exc import OperationalError
    from app.services import management

    def fail(*args, **kwargs):
        raise OperationalError('SELECT secret-password', {}, Exception('secret-password'))

    monkeypatch.setattr(management, 'create_product', fail)
    response = admin_client.post('/products', json={
        'name': 'One', 'price': '1.00', 'stock': 1, 'category_id': 1,
    })
    assert response.status_code == 503
    assert response.json() == {'detail': 'Persistência indisponível.'}


def test_security_headers_and_log_safe_correlation_id(admin_client, monkeypatch):
    from sqlalchemy.exc import OperationalError
    from app.services import management

    def fail(*args, **kwargs):
        raise OperationalError('SELECT secret', {}, Exception('database failure'))

    monkeypatch.setattr(management, 'create_product', fail)
    response = admin_client.post(
        '/products',
        headers={'x-focus-correlation-id': 'safe\nforged'},
        json={'name': 'One', 'price': '1.00', 'stock': 1, 'category_id': 1},
    )

    assert response.status_code == 503
    correlation = response.headers['x-focus-correlation-id']
    assert '\n' not in correlation and '\r' not in correlation
    assert len(correlation) == 32

    health = admin_client.get('/health')
    assert health.headers['x-content-type-options'] == 'nosniff'
    assert health.headers['x-frame-options'] == 'DENY'
    assert health.headers['referrer-policy'] == 'no-referrer'
    assert health.headers['permissions-policy'] == 'camera=(), microphone=(), geolocation=()'
