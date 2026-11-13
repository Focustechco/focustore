from datetime import datetime
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.integrations.postgres_catalog.repository import PostgresCatalogRepository
from app.models import Category, Product

from test_integrity_agent import postgres  # noqa: F401 - shared disposable PostgreSQL fixture


def test_postgres_catalog_filters_order_before_pagination(postgres):
    engine, url = postgres
    with Session(engine) as db:
        category = Category(name='Accessories', slug='pg-accessories')
        older = Product(
            name='Wireless keyboard', description='Wireless input', brand='Focus',
            price=Decimal('100.00'), base_price=Decimal('100.00'), stock=0,
            slug='pg-keyboard', sku='PG-KEYBOARD', status='ACTIVE', category=category,
            created_at=datetime(2024, 1, 1),
        )
        older.categories.append(category)
        newer = Product(
            name='Wireless mouse', description='Wireless accessory', brand='Focus',
            price=Decimal('20.00'), base_price=Decimal('20.00'), stock=0,
            slug='pg-mouse', sku='PG-MOUSE', status='ACTIVE', category=category,
            created_at=datetime(2025, 1, 1),
        )
        newer.categories.append(category)
        db.add_all([older, newer])
        db.commit()

        repository = PostgresCatalogRepository(db)
        price_page = repository.products(0, 1, sort='price_asc')
        assert price_page.total == 2
        assert price_page.items[0].slug == 'pg-mouse'
        assert repository.products(0, 10, search='keyboard').items[0].slug == 'pg-keyboard'
        assert repository.products(0, 10, category_slug='pg-accessories').total == 2
        assert repository.products(0, 10, min_price=Decimal('50.00')).total == 1
        assert repository.products(0, 10, sort='newest').items[0].slug == 'pg-mouse'
