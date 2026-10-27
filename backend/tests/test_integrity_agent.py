import os
from pathlib import Path
from uuid import uuid4

from alembic import command
from alembic.config import Config
import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError

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


def test_product_constraints_and_data(postgres):
    engine, url = postgres
    with engine.begin() as connection:
        connection.execute(text('ALTER TABLE products DROP CONSTRAINT ck_products_price_positive'))
        connection.execute(text('ALTER TABLE products DROP CONSTRAINT ck_products_stock_nonnegative'))
        connection.execute(text("INSERT INTO categories (name, slug) VALUES ('Test', 'test')"))
        connection.execute(text("INSERT INTO products (name, price, stock, category_id) SELECT 'Invalid', -1, -2, id FROM categories"))
    failures = agent.check_integrity(url)
    assert any('ck_products_price_positive' in failure for failure in failures)
    assert any('ck_products_stock_nonnegative' in failure for failure in failures)
    assert 'products with invalid data: 1' in failures


def test_connection_failure_is_nonzero(monkeypatch):
    monkeypatch.setenv('DATABASE_URL', 'postgresql+psycopg://test@127.0.0.1:1/focusstore_test?connect_timeout=1')
    assert agent.main() == 1
