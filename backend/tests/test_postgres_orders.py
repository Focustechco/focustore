from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.config import get_settings
from app.models import Inventory, Product, ProductVariant
from app.models.category import Category
from app.models.order import Order, OrderItem
from app.models.user import User, UserSession
from app.security.tokens import new_session_token, session_token_hash


def _customer(session, identifier: str):
    user = User(
        id=identifier,
        name=identifier,
        email=f'{identifier}@example.test',
        password_hash='unused',
        role='CUSTOMER',
    )
    token = new_session_token()
    session.add(user)
    session.add(UserSession(
        user_id=identifier,
        token_hash=session_token_hash(token),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    ))
    return user, token


def _catalog(session):
    category = Category(id=10, name='Teste', slug='teste', position=0, is_active=True)
    product = Product(
        id=10, name='Produto real', slug='produto-real', sku='PROD-10',
        description='Snapshot', price=Decimal('50.00'), stock=4,
        category=category, status='ACTIVE', brand='Focus', base_price=Decimal('50.00'),
    )
    variant = ProductVariant(
        id=10, product=product, sku='VAR-10', name='Azul M', price=Decimal('50.00'),
        promotional_price=Decimal('42.50'), is_active=True, image_url='/images/product.jpg',
    )
    variant.inventory = Inventory(quantity_available=4, quantity_reserved=1)
    session.add(product)
    session.commit()
    return variant


def test_order_timestamps_match_timezone_aware_postgres_migration():
    from app.models.order import Order

    assert Order.__table__.c.created_at.type.timezone is True
    assert Order.__table__.c.updated_at.type.timezone is True


def test_postgres_order_create_is_authenticated_server_priced_idempotent_and_owner_filtered(client, monkeypatch):
    monkeypatch.setenv('CATALOG_SOURCE', 'postgresql')
    get_settings.cache_clear()
    session = client.app.state.testing_session_local()
    try:
        _, customer_token = _customer(session, 'customer-one')
        _, other_token = _customer(session, 'customer-two')
        variant = _catalog(session)
        session.commit()
        client.headers['origin'] = 'http://testserver'

        response = client.post('/api/v1/orders', json={
            'items': [{'variantId': str(variant.id), 'quantity': 2}],
            'idempotencyKey': 'order-idempotency-001',
            'price': 0.01,
        })
        assert response.status_code == 401

        client.cookies.set('focus_session', new_session_token())
        # The token above is not persisted and must not authenticate.
        assert client.post('/api/v1/orders', json={
            'items': [{'variantId': str(variant.id), 'quantity': 1}],
        }).status_code == 401

        client.cookies.set('focus_session', customer_token)
        assert client.post('/api/v1/orders', json={
            'items': [{'variantId': str(variant.id), 'quantity': 2}],
            'idempotencyKey': 'order-idempotency-001',
            'price': 0.01,
        }).status_code == 422

        created = client.post('/api/v1/orders', json={
            'items': [{'variantId': str(variant.id), 'quantity': 2}],
            'idempotencyKey': 'order-idempotency-002',
        })
        assert created.status_code == 201
        data = created.json()
        assert data['status'] == 'PENDING_PAYMENT'
        assert data['subtotal'] == '85.00'
        assert data['total'] == '85.00'
        assert data['items'][0]['unit_price'] == '42.50'
        assert data['items'][0]['total_price'] == '85.00'

        replay = client.post('/api/v1/orders', json={
            'items': [{'variantId': str(variant.id), 'quantity': 999}],
            'idempotencyKey': 'order-idempotency-002',
        })
        assert replay.status_code == 201
        assert replay.json()['id'] == data['id']
        assert session.scalar(select(Order.id).where(Order.id == data['id'])) == data['id']
        assert session.scalar(select(OrderItem).where(OrderItem.order_id == data['id'])).subtotal == Decimal('85.00')
        assert variant.inventory.quantity_available == 4

        listed = client.get('/api/v1/orders')
        assert listed.status_code == 200
        assert listed.json()['total'] == 1
        assert client.get('/api/v1/orders/' + data['id']).status_code == 200

        client.cookies.set('focus_session', other_token)
        assert client.get('/api/v1/orders/' + data['id']).status_code == 404
        assert client.get('/api/v1/orders').json()['total'] == 0
        assert client.post('/api/v1/orders', json={
            'items': [{'variantId': str(variant.id), 'quantity': 1}],
            'idempotencyKey': 'order-idempotency-002',
        }).status_code == 409
    finally:
        session.close()
        get_settings.cache_clear()


def test_postgres_order_rejects_missing_stock_and_rolls_back(client, monkeypatch):
    monkeypatch.setenv('CATALOG_SOURCE', 'postgresql')
    get_settings.cache_clear()
    session = client.app.state.testing_session_local()
    try:
        _, token = _customer(session, 'customer-stock')
        variant = _catalog(session)
        session.commit()
        client.cookies.set('focus_session', token)
        client.headers['origin'] = 'http://testserver'
        response = client.post('/api/v1/orders', json={
            'items': [
                {'variantId': str(variant.id), 'quantity': 4},
                {'variantId': '999999', 'quantity': 1},
            ],
            'idempotencyKey': 'order-rollback-001',
        })
        assert response.status_code == 404
        assert session.scalar(select(Order).where(Order.idempotency_key == 'order-rollback-001')) is None

        insufficient = client.post('/api/v1/orders', json={
            'items': [{'variantId': str(variant.id), 'quantity': 4}],
            'idempotencyKey': 'order-stock-0001',
        })
        assert insufficient.status_code == 409
        assert session.scalar(select(Order).where(Order.idempotency_key == 'order-stock-0001')) is None
    finally:
        session.close()
        get_settings.cache_clear()
