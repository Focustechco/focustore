from decimal import Decimal

from app.models.category import Category
from app.models.product import Inventory, Product, ProductVariant


def test_quote_uses_postgres_catalog_ids_prices_and_available_stock(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv('CATALOG_SOURCE', 'postgresql')
    get_settings.cache_clear()
    session = client.app.state.testing_session_local()
    try:
        category = Category(id=1, name='Tecnologia', slug='tecnologia', position=0, is_active=True)
        product = Product(
            id=1, name='Produto PostgreSQL', slug='produto-postgres', sku='PG-PROD-1',
            description='Produto de teste', price=Decimal('129.90'), stock=7,
            category=category, status='ACTIVE', brand='Focus', base_price=Decimal('129.90'),
        )
        variant = ProductVariant(
            id=1, product=product, sku='PG-VAR-1', name='Preto M', price=Decimal('129.90'),
            promotional_price=Decimal('99.90'), is_active=True,
        )
        variant.inventory = Inventory(quantity_available=5, quantity_reserved=2)
        session.add(product)
        session.commit()

        response = client.post('/api/v1/cart/quote', json={
            'items': [{'variantId': '1', 'quantity': 3}],
        })

        assert response.status_code == 200
        assert response.json()['subtotal'] == '299.70'
        assert response.json()['items'][0]['product_id'] == '1'
        assert response.json()['items'][0]['unit_price'] == '99.90'
        assert client.post('/api/v1/cart/quote', json={
            'items': [{'variantId': '1', 'quantity': 4}],
        }).status_code == 409
    finally:
        session.close()
        get_settings.cache_clear()
