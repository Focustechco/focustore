from decimal import Decimal
import sqlite3
from contextlib import contextmanager

from app.integrations.legacy_catalog.repository import LegacyCatalogRepository


def test_legacy_category_detail_is_active_and_parameterized(client, legacy):
    assert client.get('/api/v1/catalog/categories/category').status_code == 200
    assert client.get('/api/v1/catalog/categories/missing').status_code == 404
    assert client.get("/api/v1/catalog/categories/x' OR '1'='1").status_code == 404


def test_price_filters_use_published_money(client, legacy):
    path, _ = legacy
    with sqlite3.connect(path) as connection:
        connection.execute('UPDATE products SET base_price = 19.995')
    response = client.get('/api/v1/catalog/products?min_price=20&max_price=20')
    assert response.status_code == 200
    assert response.json()['total'] == 1
    assert response.json()['items'][0]['base_price'] == '20.00'


def test_pg_primary_category_matches_public_mapper(postgres):
    from sqlalchemy.orm import Session
    from app.models import Product, Category
    from app.integrations.postgres_catalog.repository import PostgresCatalogRepository
    engine, _ = postgres
    with Session(engine) as db:
        db.add(Product(name='Primary', sku='PRIMARY', price=Decimal('10'), stock=0,
                       category=Category(name='Primary', slug='primary')))
        db.commit()
        page = PostgresCatalogRepository(db).products(0, 20, category_slug='primary')
        assert page.total == 1
        assert page.items[0].categories[0].slug == 'primary'


def test_legacy_page_loads_relations_in_bounded_queries(legacy, monkeypatch):
    path, _ = legacy
    with sqlite3.connect(path) as connection:
        for index in range(9):
            connection.execute('''INSERT INTO products SELECT ?,name,?,?,description,short_description,
                brand,status,base_price,promotional_price FROM products LIMIT 1''',
                (f'copy-{index}', f'copy-{index}', f'SKU-{index}'))
    repository = LegacyCatalogRepository(path)
    original = repository.connection
    queries = []

    @contextmanager
    def measured():
        with original() as connection:
            connection.set_trace_callback(queries.append)
            yield connection

    monkeypatch.setattr(repository, 'connection', measured)
    page = repository.products(0, 20)
    assert len(page.items) == 10
    assert sum(query.lstrip().upper().startswith('SELECT') for query in queries) == 5


from test_integrity_agent import postgres  # noqa: F401 -- disposable PostgreSQL fixture
