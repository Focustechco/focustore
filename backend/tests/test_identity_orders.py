import sqlite3
import pytest


@pytest.fixture
def own_orders(identity_source):
    with sqlite3.connect(identity_source) as db:
        db.executescript('''
            CREATE TABLE orders (
                id TEXT PRIMARY KEY, user_id TEXT, order_number TEXT, status TEXT,
                subtotal REAL, discount_amount REAL, shipping_amount REAL, total REAL,
                created_at DATETIME, updated_at DATETIME
            );
            CREATE TABLE order_items (
                id TEXT PRIMARY KEY, order_id TEXT, variant_id TEXT, product_name TEXT,
                variant_name TEXT, sku TEXT, unit_price REAL, quantity INTEGER,
                total_price REAL, image_url TEXT
            );
        ''')
        for identifier, owner in [('mine', 'customer'), ('other', 'admin'), ('guest', None)]:
            db.execute('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                       (identifier, owner, 'FS-' + identifier, 'PAYMENT_PENDING', 19.90, 0, 5, 24.90,
                        1793721600000, '2026-11-03T12:00:00Z'))
            db.execute('INSERT INTO order_items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                       (identifier + '-item', identifier, 'variant', 'Snapshot product',
                        'M', 'SKU', 19.90, 1, 19.90, None))
    return identity_source


def test_me_and_owner_only_orders(client, own_orders):
    before = own_orders.read_bytes()
    client.cookies.set('focus_session', 'customer-token')
    me = client.get('/api/v1/users/me')
    assert me.status_code == 200
    assert me.json() == {'id': 'customer', 'name': 'CUSTOMER', 'email': 'customer@example.test', 'role': 'CUSTOMER'}
    assert me.headers['cache-control'] == 'no-store'
    page = client.get('/api/v1/orders').json()
    assert page['total'] == 1 and page['items'][0]['id'] == 'mine'
    assert page['items'][0]['total'] == '24.90'
    assert client.get('/api/v1/orders?offset=1&limit=1').json()['items'] == []
    response = client.get('/api/v1/orders/mine')
    assert response.status_code == 200
    assert response.json()['items'][0]['unit_price'] == '19.90'
    assert response.json()['items'][0]['product_name'] == 'Snapshot product'
    assert response.headers['cache-control'] == 'no-store'
    assert response.headers['vary'] == 'Cookie'
    for identifier in ('other', 'guest', 'unknown', "' OR 1=1 --"):
        assert client.get('/api/v1/orders/' + identifier).status_code == 404
    assert client.get('/api/v1/orders?limit=101').status_code == 422
    assert client.get('/api/v1/orders?offset=-1').status_code == 422
    assert own_orders.read_bytes() == before


@pytest.mark.parametrize('path', ['/api/v1/users/me', '/api/v1/orders', '/api/v1/orders/mine'])
def test_private_routes_require_session(client, path):
    response = client.get(path)
    assert response.status_code == 401
    assert response.headers['cache-control'] == 'no-store'


def test_source_failure_is_sanitized(client, identity_source):
    client.cookies.set('focus_session', 'customer-token')
    # Identity exists, but missing order schema must be 503, not a database leak.
    response = client.get('/api/v1/orders')
    assert response.status_code == 503
    assert response.json() == {'detail': 'Pedidos indisponíveis.'}


def test_live_role_and_revocation(client, identity_source):
    client.cookies.set('focus_session', 'admin-token')
    assert client.get('/api/v1/users/me').json()['role'] == 'ADMIN'
    with sqlite3.connect(identity_source) as db:
        db.execute("UPDATE users SET role = 'CUSTOMER' WHERE id = 'admin'")
    assert client.get('/api/v1/users/me').json()['role'] == 'CUSTOMER'
    with sqlite3.connect(identity_source) as db:
        db.execute("UPDATE sessions SET expires = '2000-01-01T00:00:00Z'")
    assert client.get('/api/v1/users/me').status_code == 401
