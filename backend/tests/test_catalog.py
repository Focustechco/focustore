"""Synthetic Prisma-shaped SQLite, independent from both real databases."""
from decimal import Decimal
import sqlite3
from uuid import uuid4

import pytest

from app.config import get_settings
from app.integrations.legacy_catalog.mapper import money
from app.integrations.legacy_catalog.repository import LegacyCatalogRepository


@pytest.fixture
def legacy(tmp_path, monkeypatch, isolated_settings):
    path = tmp_path / 'catalog with spaces.db'
    ids = {name: str(uuid4()) for name in ('product', 'category', 'second_category', 'variant')}
    with sqlite3.connect(path) as connection:
        connection.executescript('''
            CREATE TABLE products (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
                sku TEXT NOT NULL UNIQUE, description TEXT NOT NULL,
                short_description TEXT, brand TEXT NOT NULL, status TEXT NOT NULL,
                base_price REAL NOT NULL, promotional_price REAL
            );
            CREATE TABLE categories (
                id TEXT PRIMARY KEY, name TEXT, slug TEXT UNIQUE, description TEXT,
                image_url TEXT, parent_id TEXT, position INTEGER, is_active BOOLEAN
            );
            CREATE TABLE product_categories (
                product_id TEXT, category_id TEXT, PRIMARY KEY(product_id, category_id)
            );
            CREATE TABLE product_images (
                id TEXT PRIMARY KEY, product_id TEXT, url TEXT, alt_text TEXT,
                position INTEGER, is_primary BOOLEAN
            );
            CREATE TABLE product_variants (
                id TEXT PRIMARY KEY, product_id TEXT, sku TEXT UNIQUE, name TEXT,
                color TEXT, color_hex TEXT, size TEXT, model TEXT, price REAL,
                promotional_price REAL, image_url TEXT, position INTEGER, is_active BOOLEAN
            );
            CREATE TABLE inventory (
                id TEXT PRIMARY KEY, variant_id TEXT UNIQUE,
                quantity_available INTEGER, quantity_reserved INTEGER
            );
        ''')
        connection.execute(
            'INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (ids['product'], 'Teclado', 'teclado', 'KEY-1', 'Descrição', None,
             'Focus', 'ACTIVE', 199.90, 179.90),
        )
        for position, key in enumerate(('category', 'second_category')):
            connection.execute('INSERT INTO categories VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                               (ids[key], key, key, None, '/images/category.jpg', None, position, 1))
            connection.execute('INSERT INTO product_categories VALUES (?, ?)',
                               (ids['product'], ids[key]))
        connection.executemany('INSERT INTO product_images VALUES (?, ?, ?, ?, ?, ?)', [
            ('img-b', ids['product'], 'https://cdn.example/primary.jpg', 'Primary', 2, 1),
            ('img-a', ids['product'], '/images/detail.jpg', None, 0, 0),
        ])
        connection.execute('INSERT INTO product_variants VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                           (ids['variant'], ids['product'], 'KEY-1-B', 'Preto', 'Preto',
                            '#000000', 'M', None, 199.90, 169.90, '/images/black.jpg', 0, 1))
        connection.execute('INSERT INTO inventory VALUES (?, ?, ?, ?)',
                           ('inventory-1', ids['variant'], 3, 7))
    monkeypatch.setenv('LEGACY_CATALOG_SQLITE_PATH', str(path))
    get_settings.cache_clear()
    return path, ids


def test_full_mapping_and_original_identifiers(client, legacy):
    path, ids = legacy
    before = path.read_bytes()
    response = client.get('/api/v1/catalog/products/teclado')
    assert response.status_code == 200
    data = response.json()
    assert data['id'] == ids['product']
    assert data['base_price'] == '199.90'
    assert data['promotional_price'] == '179.90'
    assert data['description'] == 'Descrição'
    assert data['short_description'] is None
    assert data['sku'] == 'KEY-1'
    assert data['status'] == 'ACTIVE'
    assert [image['url'] for image in data['images']] == [
        '/images/detail.jpg', 'https://cdn.example/primary.jpg'
    ]
    assert data['primary_image']['id'] == 'img-b'
    assert {category['id'] for category in data['categories']} == {
        ids['category'], ids['second_category']
    }
    variant = data['variants'][0]
    assert variant['id'] == ids['variant']
    assert variant['price'] == '199.90'
    assert variant['promotional_price'] == '169.90'
    assert variant['image_url'] == '/images/black.jpg'
    assert variant['quantity_available'] == 3
    assert variant['quantity_reserved'] == 7
    # Available already excludes reservations. Do not calculate 3 - 7.
    assert variant['available'] is True
    assert data['available'] is True
    assert 'stock' not in data
    assert path.read_bytes() == before


def test_pagination_no_join_duplicates_and_fresh_queries(client, legacy):
    path, ids = legacy
    first = client.get('/api/v1/catalog/products?limit=1').json()
    assert first['total'] == 1
    assert [item['id'] for item in first['items']] == [ids['product']]
    new_id = str(uuid4())
    with sqlite3.connect(path) as connection:
        connection.execute('''
            INSERT INTO products SELECT ?, 'Novo', 'z-novo', 'NEW', description,
            short_description, brand, status, base_price, NULL FROM products WHERE id = ?
        ''', (new_id, ids['product']))
    second = client.get('/api/v1/catalog/products?offset=1&limit=1').json()
    assert second['total'] == 2
    assert second['offset'] == 1 and second['limit'] == 1
    assert [item['id'] for item in second['items']] == [new_id]
    assert second['items'][0]['promotional_price'] is None
    assert second['items'][0]['primary_image'] is None
    assert second['items'][0]['variants'] == []
    assert second['items'][0]['available'] is False
    assert client.get('/api/v1/catalog/products/z-novo').json()['id'] == new_id
    assert client.get('/api/v1/catalog/products?offset=2').json()['items'] == []


def test_active_filters_and_categories_pagination(client, legacy):
    path, ids = legacy
    with sqlite3.connect(path) as connection:
        connection.execute('UPDATE categories SET is_active = 0 WHERE id = ?',
                           (ids['second_category'],))
        connection.execute('UPDATE product_variants SET is_active = 0')
    categories = client.get('/api/v1/catalog/categories?limit=1').json()
    assert categories['total'] == 1
    assert categories['items'][0]['id'] == ids['category']
    assert categories['items'][0]['image_url'] == '/images/category.jpg'
    assert client.get('/api/v1/catalog/categories?offset=1').json()['items'] == []
    product = client.get('/api/v1/catalog/products/teclado').json()
    assert len(product['categories']) == 1
    assert product['variants'] == [] and product['available'] is False


@pytest.mark.parametrize('status', ['DRAFT', 'ARCHIVED'])
def test_nonpublic_products_hidden(client, legacy, status):
    path, _ = legacy
    with sqlite3.connect(path) as connection:
        connection.execute('UPDATE products SET status = ?', (status,))
    assert client.get('/api/v1/catalog/products').json()['total'] == 0
    assert client.get('/api/v1/catalog/products/teclado').status_code == 404


def test_missing_inventory_and_image_fallback(client, legacy):
    path, _ = legacy
    with sqlite3.connect(path) as connection:
        connection.execute('DELETE FROM inventory')
        connection.execute('UPDATE product_images SET is_primary = 0')
    product = client.get('/api/v1/catalog/products/teclado').json()
    assert product['primary_image']['id'] == 'img-a'
    assert product['variants'][0]['quantity_available'] is None
    assert product['variants'][0]['quantity_reserved'] is None
    assert product['available'] is False


def test_multiple_variants_do_not_merge_inventory(client, legacy):
    path, ids = legacy
    with sqlite3.connect(path) as connection:
        connection.execute('UPDATE inventory SET quantity_available = 0')
        connection.execute('''
            INSERT INTO product_variants SELECT 'second', product_id, 'KEY-2', name,
            color, color_hex, size, model, price, NULL, image_url, 1, 1
            FROM product_variants WHERE id = ?
        ''', (ids['variant'],))
        connection.execute("INSERT INTO inventory VALUES ('second', 'second', 2, 0)")
    product = client.get('/api/v1/catalog/products/teclado').json()
    assert [v['quantity_available'] for v in product['variants']] == [0, 2]
    assert [v['available'] for v in product['variants']] == [False, True]
    assert product['available'] is True


@pytest.mark.parametrize('slug', ['missing', "teclado' OR '1'='1"])
def test_not_found_and_parameterized_slug(client, legacy, slug):
    assert client.get(f'/api/v1/catalog/products/{slug}').status_code == 404


@pytest.mark.parametrize('query', ['offset=-1', 'limit=0', 'limit=101', 'limit=no'])
@pytest.mark.parametrize('resource', ['products', 'categories'])
def test_invalid_pagination(client, legacy, resource, query):
    assert client.get(f'/api/v1/catalog/{resource}?{query}').status_code == 422


@pytest.mark.parametrize('endpoint', ['products', 'products/teclado', 'categories'])
def test_unconfigured_source(client, endpoint):
    response = client.get(f'/api/v1/catalog/{endpoint}')
    assert response.status_code == 503
    assert response.json() == {'detail': 'Catálogo indisponível.'}
    assert client.get('/health').status_code == 200
    assert client.get('/products').status_code == 200


@pytest.mark.parametrize('source', ['missing', 'invalid', 'relative', 'corrupt'])
def test_unavailable_source_is_safe(client, tmp_path, monkeypatch, source):
    path = tmp_path / 'private-source.db'
    if source == 'invalid':
        with sqlite3.connect(path) as connection:
            connection.execute('CREATE TABLE unrelated (id INTEGER)')
    elif source == 'corrupt':
        path.write_text('not a database', encoding='utf-8')
    monkeypatch.setenv('LEGACY_CATALOG_SQLITE_PATH', 'relative.db' if source == 'relative' else str(path))
    get_settings.cache_clear()
    for endpoint in ('products', 'products/teclado', 'categories'):
        response = client.get(f'/api/v1/catalog/{endpoint}')
        assert response.status_code == 503
        assert response.json() == {'detail': 'Catálogo indisponível.'}
        assert 'private-source' not in response.text
    if source == 'missing':
        assert not path.exists()


def test_invalid_source_values_fail_closed(client, legacy):
    path, _ = legacy
    with sqlite3.connect(path) as connection:
        connection.execute('UPDATE products SET base_price = -1')
    assert client.get('/api/v1/catalog/products').status_code == 503


def test_repository_connection_rejects_writes(legacy):
    path, _ = legacy
    repository = LegacyCatalogRepository(path)
    with repository.connection() as connection:
        assert connection.execute('PRAGMA query_only').fetchone()[0] == 1
        with pytest.raises(sqlite3.OperationalError, match='readonly'):
            connection.execute('DELETE FROM products')
    # Independently verify the URI is read-only even if query_only is switched off.
    with repository.connection() as connection:
        connection.execute('PRAGMA query_only = OFF')
        with pytest.raises(sqlite3.OperationalError, match='readonly'):
            connection.execute('DELETE FROM products')
    assert repository.products(0, 20).total == 1


def test_money_rounding():
    assert money('19.995') == Decimal('20.00')
    assert money('0') == Decimal('0.00')
    assert money(None) is None
    for value in ('NaN', 'Infinity', '-0.001'):
        with pytest.raises(ValueError):
            money(value)
