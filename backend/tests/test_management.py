import sqlite3
import pytest


def category(client, slug='one'):
    response = client.post('/categories', json={'name': 'One', 'slug': slug})
    assert response.status_code == 201
    return response.json()['id']


def product(client, category_id):
    response = client.post('/products', json={
        'name': 'Keyboard', 'price': '19.90', 'stock': 3, 'category_id': category_id,
    })
    assert response.status_code == 201
    return response.json()['id']


def test_management_lifecycle_and_integrity(admin_client):
    client = admin_client
    first = category(client)
    second = category(client, 'two')
    identifier = product(client, first)
    assert client.get('/categories?limit=1&skip=1').json()[0]['id'] == second
    assert client.get(f'/categories/{first}').status_code == 200
    assert client.patch(f'/categories/{first}', json={'slug': 'two'}).status_code == 409
    assert client.get(f'/categories/{first}').json()['slug'] == 'one'
    assert client.delete(f'/categories/{first}').status_code == 409
    changed = client.patch(f'/products/{identifier}', json={
        'price': '20.10', 'stock': 0, 'category_id': second, 'description': None,
    })
    assert changed.status_code == 200
    assert changed.json()['price'] == '20.10'
    assert client.delete(f'/categories/{first}').status_code == 204
    assert client.get(f'/categories/{first}').status_code == 404
    assert client.get('/products?category_id=' + str(first)).json() == []
    assert len(client.get('/products?q=board').json()) == 1
    assert client.get('/products?q=%25').json() == []
    assert client.patch(f'/products/{identifier}', json={'category_id': 999}).status_code == 404
    assert client.get(f'/products/{identifier}').json()['category_id'] == second
    assert client.delete(f'/products/{identifier}').status_code == 204
    assert client.delete(f'/products/{identifier}').status_code == 404
    assert client.delete(f'/categories/{second}').status_code == 204


@pytest.mark.parametrize('body', [{}, {'name': '  '}, {'price': None}, {'price': '0'},
    {'price': 'NaN'}, {'stock': True}, {'stock': 1.5}, {'stock': -1}, {'name': 'x', 'id': 2}])
def test_invalid_product_patch(admin_client, body):
    identifier = product(admin_client, category(admin_client))
    assert admin_client.patch(f'/products/{identifier}', json=body).status_code == 422
    assert admin_client.get(f'/products/{identifier}').json()['stock'] == 3


@pytest.mark.parametrize('method,path,body', [
    ('post', '/categories', {'name': 'x', 'slug': 'x'}),
    ('post', '/products', {'name': 'x', 'price': '1.00', 'stock': 1, 'category_id': 1}),
    ('patch', '/categories/1', {'name': 'x'}), ('delete', '/products/1', None),
])
def test_anonymous_writes_denied(client, method, path, body):
    response = client.request(method, path, json=body)
    assert response.status_code == 401


def test_roles_expiry_revocation_origin_and_source(client, identity_source):
    path = identity_source
    client.headers['origin'] = 'http://testserver'
    before = path.read_bytes()
    for token, expected in [('customer-token', 403), ('expired-token', 401),
                            ('unknown-token', 401), ('manager-token', 201)]:
        client.cookies.set('focus_session', token)
        assert client.post('/categories', json={'name': 'x', 'slug': token}).status_code == expected
    assert path.read_bytes() == before  # Auth never writes to Prisma.
    client.cookies.set('focus_session', 'admin-token')
    for origin in ('https://evil.test', 'null', ''):
        assert client.post('/categories', headers={'origin': origin},
                           json={'name': 'x', 'slug': 'csrf'}).status_code == 403
    assert client.post('/categories', headers={'sec-fetch-site': 'cross-site'},
                       json={'name': 'x', 'slug': 'csrf'}).status_code == 403
    connection = sqlite3.connect(path)
    try:
        with connection:
            connection.execute("DELETE FROM sessions WHERE session_token = 'admin-token'")
    finally:
        connection.close()
    assert client.post('/categories', json={'name': 'x', 'slug': 'revoked'}).status_code == 401
    path.unlink()
    assert client.get('/api/v1/users/me').status_code == 503


def test_stock_adjustment_and_limits(admin_client):
    identifier = product(admin_client, category(admin_client))
    url = f'/products/{identifier}/stock-adjustments'
    assert admin_client.post(url, json={'delta': -2}).json()['stock'] == 1
    assert admin_client.post(url, json={'delta': -2}).status_code == 409
    assert admin_client.get(f'/products/{identifier}').json()['stock'] == 1
    assert admin_client.post(url, json={'delta': 3}).json()['stock'] == 4
    for delta in (0, True, 1.5, '1', 2147483648):
        assert admin_client.post(url, json={'delta': delta}).status_code == 422
    assert admin_client.post('/products/999/stock-adjustments', json={'delta': 1}).status_code == 404
    assert admin_client.post(url, json={'delta': 2147483647}).status_code == 409


def test_concurrent_stock_decrements(tmp_path):
    from concurrent.futures import ThreadPoolExecutor
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.db.base import Base
    from app.models.category import Category
    from app.models.product import Product
    from app.services.management import adjust_stock, DomainError

    engine = create_engine('sqlite:///' + str(tmp_path / 'concurrent.db'), connect_args={'timeout': 5})
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(Category(id=1, name='One', slug='one'))
        db.flush()
        db.add(Product(id=1, name='One', price='1.00', stock=1, category_id=1))
        db.commit()

    from threading import Barrier
    barrier = Barrier(2)

    def decrement():
        barrier.wait(timeout=5)
        with Session(engine) as db:
            try:
                adjust_stock(db, 1, -1)
                return 'ok'
            except DomainError as exc:
                assert exc.status == 409
                return 'conflict'

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            assert sorted(executor.map(lambda _: decrement(), range(2))) == ['conflict', 'ok']
        with Session(engine) as db:
            assert db.get(Product, 1).stock == 0
    finally:
        engine.dispose()
