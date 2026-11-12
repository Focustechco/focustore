import os
from pathlib import Path
from uuid import UUID, uuid4

from alembic import command
from alembic.config import Config
import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.agents import integrity as agent


@pytest.fixture
def postgres(monkeypatch):
    """Use only an explicitly supplied temporary local test DB, never DATABASE_URL."""
    raw = os.environ.get('TEST_DATABASE_URL')
    if not raw:
        if os.environ.get('CI'):
            pytest.fail('CI requires TEST_DATABASE_URL for PostgreSQL integration')
        pytest.skip('Set TEST_DATABASE_URL to a temporary local PostgreSQL *_test database')
    url = make_url(raw)
    assert url.get_backend_name() == 'postgresql'
    assert url.host in {'localhost', '127.0.0.1', '::1'}
    assert url.database and url.database.endswith('_test')
    admin = create_engine(url, hide_parameters=True)
    schema = 'agent_test_' + uuid4().hex
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    test_url = url.update_query_dict({'options': f'-csearch_path={schema}'})
    raw_test_url = test_url.render_as_string(hide_password=False)
    monkeypatch.setenv('DATABASE_URL', raw_test_url)
    from app.config import get_settings
    get_settings.cache_clear()
    engine = create_engine(test_url, hide_parameters=True)
    try:
        command.upgrade(Config(str(Path(__file__).resolve().parents[1] / 'alembic.ini')), 'head')
        yield engine, raw_test_url
    finally:
        engine.dispose()
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()
        get_settings.cache_clear()


def test_healthy_database_and_cli(postgres, capsys):
    engine, url = postgres
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO categories (name, slug) VALUES ('Books', 'books')"))
    assert agent.check_integrity(url) == []
    assert agent.main() == 0
    assert 'PASS' in capsys.readouterr().out
    with engine.connect() as connection:
        assert connection.execute(text('SELECT count(*) FROM categories')).scalar_one() == 1


def test_missing_table_and_stale_revision(postgres):
    engine, url = postgres
    with engine.begin() as connection:
        connection.execute(text("UPDATE alembic_version SET version_num = '7ec8ee7c05e5'"))
        connection.execute(text("DROP TABLE categories CASCADE"))
    failures = agent.check_integrity(url)
    assert any('Alembic' in item for item in failures)
    assert 'Missing categories table' in failures


def test_missing_columns(postgres):
    engine, url = postgres
    with engine.begin() as connection:
        connection.execute(text('ALTER TABLE categories DROP COLUMN slug'))
    assert 'Missing required columns in categories' in agent.check_integrity(url)


def test_data_and_schema_violations(postgres):
    engine, url = postgres
    with engine.begin() as connection:
        connection.execute(text("DROP TABLE categories CASCADE"))
        connection.execute(text('CREATE TABLE categories (id integer, name text, slug text)'))
        connection.execute(text("INSERT INTO categories VALUES (1, '', 'same'), (2, NULL, 'same'), (3, repeat('a', 121), '  ')"))
    failures = agent.check_integrity(url)
    for expected in ['primary key', 'NOT NULL', 'unique constraint', 'empty name: 2', 'empty slug: 1', 'duplicate category slugs: 1', 'exceeding declared lengths: 1']:
        assert any(expected in item for item in failures), failures
    assert agent.main() == 1


def test_database_enforces_read_only(postgres, monkeypatch):
    engine, url = postgres
    observed = []
    @event.listens_for(engine, 'before_cursor_execute')
    def verify(connection, cursor, statement, parameters, context, executemany):
        if statement == 'SELECT 1':
            assert connection.exec_driver_sql('SHOW transaction_read_only').scalar_one() == 'on'
            savepoint = connection.begin_nested()
            with pytest.raises(DBAPIError):
                connection.execute(text("INSERT INTO categories (name, slug) VALUES ('blocked', 'blocked')"))
            savepoint.rollback()
            observed.append(True)
    monkeypatch.setattr(agent, 'create_engine', lambda *args, **kwargs: engine)
    assert agent.check_integrity(url) == []
    assert observed == [True]


def test_failure_exit_and_secret_redaction(monkeypatch, capsys):
    def fail():
        raise RuntimeError('postgresql://user:secret@private-host/db')
    monkeypatch.setattr(agent, 'check_integrity', fail)
    assert agent.main() == 1
    output = capsys.readouterr().out
    assert 'RuntimeError' in output
    assert 'secret' not in output and 'private-host' not in output


def test_non_postgres_rejected():
    assert agent.check_integrity('sqlite://') == ['Integrity agent requires PostgreSQL']


def test_public_ids_are_backfilled_unique_and_immutable_on_postgresql(postgres):
    from app.models import Category, Product, ProductVariant

    engine, _ = postgres
    with Session(engine) as db:
        category = Category(name='Public', slug='public')
        product = Product(
            name='Public product', description=None, price='10.00', stock=1,
            category=category, slug='public-product', sku='PUBLIC-1', base_price='10.00',
        )
        variant = ProductVariant(product=product, sku='PUBLIC-1-DEFAULT', name='Default', price='10.00')
        db.add_all([product, variant])
        db.commit()
        product_id, variant_id = product.public_id, variant.public_id

    assert product_id != variant_id
    with engine.connect() as connection:
        transaction = connection.begin()
        with pytest.raises(DBAPIError, match='immutable'):
            connection.execute(
                text('UPDATE products SET public_id = :public_id WHERE slug = :slug'),
                {'public_id': str(uuid4()), 'slug': 'public-product'},
            )
        transaction.rollback()

    with engine.connect() as connection:
        transaction = connection.begin()
        with pytest.raises(DBAPIError):
            connection.execute(
                text('INSERT INTO products (name, price, stock, category_id, public_id) '
                     'VALUES (:name, 10.00, 0, 1, :public_id)'),
                {'name': 'Duplicate public ID', 'public_id': str(product_id)},
            )
        transaction.rollback()

    with Session(engine) as db:
        product = db.scalar(text('SELECT public_id FROM products WHERE slug = :slug'), {'slug': 'public-product'})
        assert str(product) == str(product_id)


def test_public_id_migration_backfills_existing_postgresql_rows(postgres):
    engine, _ = postgres
    config = Config(str(Path(__file__).resolve().parents[1] / 'alembic.ini'))
    command.downgrade(config, 'a7b8c9d0e1f2')
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO categories (name, slug) VALUES ('Legacy', 'legacy')"))
        connection.execute(text(
            "INSERT INTO products (name, price, stock, category_id) VALUES ('Legacy', 9.90, 2, 1)"
        ))
        connection.execute(text(
            "INSERT INTO product_variants (product_id, sku, name, price) "
            "VALUES (1, 'LEGACY-DEFAULT', 'Default', 9.90)"
        ))

    command.upgrade(config, 'head')
    with engine.begin() as connection:
        product_public_id = connection.execute(text('SELECT public_id FROM products WHERE id = 1')).scalar_one()
        variant_public_id = connection.execute(
            text('SELECT public_id FROM product_variants WHERE id = 1')
        ).scalar_one()
        assert UUID(str(product_public_id))
        assert UUID(str(variant_public_id))


def test_connection_failure_is_nonzero(monkeypatch):
    monkeypatch.setenv('DATABASE_URL', 'postgresql+psycopg://test@127.0.0.1:1/focusstore_test?connect_timeout=1')
    assert agent.main() == 1
