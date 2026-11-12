from decimal import Decimal

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models import Category, Inventory, Product, ProductCategory, ProductImage, ProductVariant


def test_catalog_relationships_and_constraints_on_disposable_sqlite():
    engine = create_engine('sqlite:///:memory:')
    Base.metadata.create_all(engine)

    with Session(engine) as db:
        category = Category(name='Acessórios', slug='acessorios')
        product = Product(
            name='Produto', description='Descrição', price=Decimal('29.90'),
            base_price=Decimal('29.90'), stock=0, slug='produto', sku='SKU-PRODUTO',
            category=category,
        )
        product.images.append(ProductImage(url='/images/product.jpg', is_primary=True))
        variant = ProductVariant(product=product, sku='SKU-PRODUTO-B', name='Preto', price=Decimal('29.90'))
        variant.inventory = Inventory(quantity_available=4, quantity_reserved=1)
        product.categories.append(category)
        db.add(product)
        db.commit()

        loaded = db.scalar(select(Product).where(Product.slug == 'produto'))
        assert loaded is not None
        assert loaded.category.slug == 'acessorios'
        assert loaded.categories[0].slug == 'acessorios'
        assert loaded.images[0].url == '/images/product.jpg'
        assert loaded.variants[0].inventory.quantity_available == 4
        assert db.scalar(select(ProductCategory).where(ProductCategory.product_id == loaded.id)) is not None
