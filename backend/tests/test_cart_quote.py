import sqlite3
import pytest


URL = '/api/v1/cart/quote'


def test_quote_add_update_remove_without_writes(client, legacy):
    path, ids = legacy
    before = path.read_bytes()
    item = {'variantId': ids['variant'], 'quantity': 1}
    quote = client.post(URL, json={'items': [item, item]})
    assert quote.status_code == 200
    data = quote.json()
    assert data['subtotal'] == '339.80'
    assert data['total_items'] == 2
    assert data['items'][0]['quantity'] == 2
    assert data['items'][0]['unit_price'] == '169.90'
    assert data['items'][0]['product_id'] == ids['product']
    assert data['reserves_stock'] is False
    assert data['currency'] == 'BRL'
    assert client.post(URL, json={'items': [{**item, 'quantity': 3}]}).json()['subtotal'] == '509.70'
    empty = client.post(URL, json={'items': []})
    assert empty.status_code == 200
    assert empty.json()['subtotal'] == '0.00'
    assert empty.json()['items'] == []
    assert path.read_bytes() == before


@pytest.mark.parametrize('quantity', [0, -1, True, 1.5, '2', 1000])
def test_invalid_quantities(client, legacy, quantity):
    _, ids = legacy
    assert client.post(URL, json={'items': [{'variantId': ids['variant'], 'quantity': quantity}]}).status_code == 422


def test_stock_duplicates_missing_and_inactive(client, legacy):
    path, ids = legacy
    item = {'variantId': ids['variant'], 'quantity': 2}
    assert client.post(URL, json={'items': [item, item]}).status_code == 409
    assert client.post(URL, json={'items': [{'variantId': 'missing', 'quantity': 1}]}).status_code == 404
    with sqlite3.connect(path) as db:
        db.execute('UPDATE product_variants SET is_active = 0')
    assert client.post(URL, json={'items': [item]}).status_code == 404
    with sqlite3.connect(path) as db:
        db.execute('UPDATE product_variants SET is_active = 1')
        db.execute("UPDATE products SET status = 'DRAFT'")
    assert client.post(URL, json={'items': [item]}).status_code == 404


def test_quote_rejects_client_prices_and_limits(client, legacy):
    _, ids = legacy
    item = {'variantId': ids['variant'], 'quantity': 1}
    assert client.post(URL, json={'items': [{**item, 'price': 0.01}]}).status_code == 422
    assert client.post(URL, json={'items': [item], 'userId': 'admin'}).status_code == 422
    assert client.post(URL, json={'items': [item] * 101}).status_code == 422
    assert client.post(URL, json={'items': [{**item, 'quantity': 500}] * 2}).status_code == 422
    # SQL payload is a bound identifier, not SQL.
    assert client.post(URL, json={'items': [{**item, 'variantId': "' OR 1=1 --"}]}).status_code == 404


def test_availability_missing_inventory_zero_promo_and_fresh_prices(client, legacy):
    path, ids = legacy
    url = '/api/v1/catalog/variants/' + ids['variant'] + '/availability'
    assert client.get(url).json()['quantity_available'] == 3  # already excludes reserved=7
    with sqlite3.connect(path) as db:
        db.execute('UPDATE product_variants SET promotional_price = 0')
    assert client.post(URL, json={'items': [{'variantId': ids['variant'], 'quantity': 1}]}).json()['subtotal'] == '0.00'
    with sqlite3.connect(path) as db:
        db.execute('UPDATE product_variants SET promotional_price = NULL, price = 10.15')
    assert client.post(URL, json={'items': [{'variantId': ids['variant'], 'quantity': 3}]}).json()['subtotal'] == '30.45'
    with sqlite3.connect(path) as db:
        db.execute('DELETE FROM inventory')
    assert client.get(url).json()['available'] is False
    assert client.post(URL, json={'items': [{'variantId': ids['variant'], 'quantity': 1}]}).status_code == 409


def test_unconfigured_and_corrupted_source(client, legacy, monkeypatch):
    from app.config import get_settings
    path, ids = legacy
    payload = {'items': [{'variantId': ids['variant'], 'quantity': 1}]}
    path.write_bytes(b'invalid source with secret-password')
    response = client.post(URL, json=payload)
    assert response.status_code == 503
    assert 'secret-password' not in response.text
    monkeypatch.delenv('LEGACY_CATALOG_SQLITE_PATH')
    get_settings.cache_clear()
    assert client.post(URL, json=payload).status_code == 503


@pytest.mark.parametrize('column', ['name', 'sku'])
def test_invalid_source_metadata_returns_sanitized_503(client, legacy, column):
    path, ids = legacy
    # Intentionally corrupt only the synthetic source, never a real catalog.
    with sqlite3.connect(path) as db:
        db.execute(f'UPDATE product_variants SET {column} = NULL')
    response = client.post(URL, json={'items': [{'variantId': ids['variant'], 'quantity': 1}]})
    assert response.status_code == 503
    assert response.json() == {'detail': 'Catálogo indisponível.'}
    assert str(path) not in response.text
