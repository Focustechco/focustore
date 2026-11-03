import pytest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.db.dependencies import get_db


@pytest.fixture(autouse=True)
def isolated_settings(monkeypatch, tmp_path):
    from app.config import Settings, get_settings

    monkeypatch.setenv("DEBUG", "release")
    monkeypatch.setenv("FOCUS_DEBUG", "false")
    monkeypatch.setenv("APP_NAME", "FocusStore API")
    monkeypatch.setenv("APP_VERSION", "0.1.0")
    monkeypatch.delenv("LEGACY_CATALOG_SQLITE_PATH", raising=False)
    monkeypatch.delenv("FRONTEND_ORIGIN", raising=False)
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{(tmp_path / 'test.db').as_posix()}")
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def client(tmp_path, isolated_settings):
    from app.main import app

    database_file = tmp_path / "categories_test.db"

    engine = create_engine(
        f"sqlite:///{database_file.as_posix()}",
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, 'connect')
    def enable_foreign_keys(connection, record):
        connection.execute('PRAGMA foreign_keys = ON')

    Base.metadata.create_all(bind=engine)

    TestingSessionLocal = sessionmaker(
        bind=engine,
        autoflush=False,
        expire_on_commit=False,
    )

    def override_get_db():
        db = TestingSessionLocal()

        try:
            yield db
        finally:
            db.close()

    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        if previous_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override

        engine.dispose()




@pytest.fixture
def identity_source(tmp_path, monkeypatch, isolated_settings):
    """Synthetic real-format session source; production resolver is not bypassed."""
    from datetime import datetime, timedelta, timezone
    import sqlite3
    from app.config import get_settings

    path = tmp_path / 'identity.db'
    expires = int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp() * 1000)
    with sqlite3.connect(path) as connection:
        connection.executescript('''
            CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT, role TEXT);
            CREATE TABLE sessions (id TEXT PRIMARY KEY, session_token TEXT UNIQUE,
                                   user_id TEXT, expires DATETIME);
        ''')
        for role in ('ADMIN', 'MANAGER', 'CUSTOMER'):
            connection.execute('INSERT INTO users VALUES (?, ?, ?, ?)',
                               (role.lower(), role, role.lower() + '@example.test', role))
            connection.execute('INSERT INTO sessions VALUES (?, ?, ?, ?)',
                               (role, role.lower() + '-token', role.lower(), expires))
        connection.execute('INSERT INTO sessions VALUES (?, ?, ?, ?)',
                           ('expired', 'expired-token', 'admin', 1))
    monkeypatch.setenv('LEGACY_CATALOG_SQLITE_PATH', str(path))
    get_settings.cache_clear()
    return path


@pytest.fixture
def admin_client(client, identity_source):
    client.cookies.set('focus_session', 'admin-token')
    client.headers['origin'] = 'http://testserver'
    return client


@pytest.fixture
def legacy(tmp_path, monkeypatch, isolated_settings):
    import sqlite3
    from uuid import uuid4
    from app.config import get_settings

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

