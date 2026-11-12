from types import SimpleNamespace
from decimal import Decimal

from app.integrations.postgres_catalog.mapper import product_schema


def test_postgres_catalog_mapping_preserves_variants_images_and_categories():
    category = SimpleNamespace(
        id=7, name='Acessórios', slug='acessorios', description=None,
        image_url='/images/category.jpg', parent_id=None, position=1, is_active=True,
    )
    variant = SimpleNamespace(
        id=11, sku='SKU-11', name='Preto', color='Preto', color_hex='#000000',
        size=None, model=None, price=Decimal('19.90'), promotional_price=Decimal('17.90'),
        image_url='/images/variant.jpg', position=0, is_active=True,
        inventory=SimpleNamespace(quantity_available=3, quantity_reserved=1),
    )
    product = SimpleNamespace(
        id=3, name='Produto', slug='produto', sku='SKU-3', description='Descrição',
        short_description=None, brand='Focus', status='ACTIVE', base_price=Decimal('29.90'),
        price=Decimal('29.90'), promotional_price=None, images=[SimpleNamespace(
            id=19, url='/images/product.jpg', alt_text='Frente', position=0, is_primary=True,
        )], categories=[category], category=category, variants=[variant],
    )

    result = product_schema(product)

    assert result.id == '3'
    assert result.categories[0].id == '7'
    assert result.images[0].url == '/images/product.jpg'
    assert result.variants[0].quantity_available == 3
    assert result.variants[0].promotional_price == Decimal('17.90')
    assert result.available is True


def test_postgres_catalog_mapping_does_not_mark_reserved_only_stock_available():
    product = SimpleNamespace(
        id=4, name='Sem estoque', slug='sem-estoque', sku='SKU-4', description=None,
        short_description=None, brand='Focus', status='ACTIVE', base_price=None,
        price=Decimal('10.00'), promotional_price=None, images=[], categories=[], category=None,
        variants=[SimpleNamespace(
            id=12, sku='SKU-12', name='Único', color=None, color_hex=None, size=None,
            model=None, price=Decimal('10.00'), promotional_price=None, image_url=None,
            position=0, is_active=True,
            inventory=SimpleNamespace(quantity_available=0, quantity_reserved=2),
        )],
    )

    result = product_schema(product)

    assert result.available is False
    assert result.variants[0].available is False
