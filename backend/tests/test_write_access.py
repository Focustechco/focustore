import pytest

from app.config import get_settings


@pytest.mark.parametrize('environment,enabled', [('production', 'true'), ('production', 'false'), ('test', 'false')])
@pytest.mark.parametrize('endpoint,payload', [
    ('/products', {'name': 'X', 'price': '1.00', 'stock': 1, 'category_id': 1}),
    ('/categories', {'name': 'X', 'slug': 'x'}),
])
def test_writes_fail_closed(client, monkeypatch, environment, enabled, endpoint, payload):
    monkeypatch.setenv('APP_ENVIRONMENT', environment)
    monkeypatch.setenv('ALLOW_LOCAL_WRITES', enabled)
    get_settings.cache_clear()
    assert client.post(endpoint, json=payload).status_code == 503
    assert client.get('/health').status_code == 200
    assert client.get('/products').status_code == 200


def test_writes_disabled_by_default(monkeypatch):
    from app.config import Settings

    monkeypatch.delenv('APP_ENVIRONMENT')
    monkeypatch.delenv('ALLOW_LOCAL_WRITES')
    settings = Settings(_env_file=None)
    assert settings.app_environment == 'production'
    assert settings.allow_local_writes is False


@pytest.mark.parametrize('endpoint,payload', [
    ('/products', {'name': '   ', 'price': '1.00', 'stock': 1, 'category_id': 1}),
    ('/categories', {'name': '  ', 'slug': 'x'}),
    ('/categories', {'name': 'X', 'slug': '  '}),
])
def test_blank_names_and_slugs_rejected(client, endpoint, payload):
    assert client.post(endpoint, json=payload).status_code == 422
