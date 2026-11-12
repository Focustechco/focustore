"""Public identity guarantees on migrated, disposable PostgreSQL schemas."""
from uuid import UUID, uuid4

import pytest
from alembic import command
from alembic.config import Config
from pathlib import Path
from sqlalchemy import event, inspect, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.models import Category, Product, ProductVariant
from test_integrity_agent import postgres  # noqa: F401 -- shared disposable fixture


@pytest.mark.parametrize('model', [Product, ProductVariant])
def test_generation_stability_uniqueness_and_immutability(postgres, model):
    engine, _ = postgres
    with Session(engine) as db:
        product = Product(name='Identity', price='10.00', stock=1,
                          category=Category(name='Identity', slug='identity'))
        variant = ProductVariant(product=product, name='Default', sku='identity', price='10.00')
        db.add_all([product, variant])
        db.commit()
        row = product if model is Product else variant
        identifier, public_id = row.id, row.public_id
        assert isinstance(public_id, UUID) and public_id.version == 4
        assert product.public_id != variant.public_id
        row.name = 'Updated'
        db.commit()

    with Session(engine) as db:
        row = db.get(model, identifier)
        assert row.public_id == public_id
        assert row.name == 'Updated'
        row.public_id = uuid4()
        with pytest.raises(DBAPIError, match='immutable'):
            db.commit()
        db.rollback()
        assert row.public_id == public_id

        # SQLAlchemy Core updates also pass through the database trigger.
        with pytest.raises(DBAPIError, match='immutable'):
            db.execute(model.__table__.update().values(public_id=uuid4()))
        db.rollback()
        with pytest.raises(DBAPIError, match='immutable'):
            db.execute(model.__table__.update().values(public_id=None))
        db.rollback()

        if model is Product:
            duplicate = Product(name='Duplicate', price='10.00', stock=0,
                                category_id=db.scalar(select(Category.id)), public_id=public_id)
        else:
            duplicate = ProductVariant(product_id=db.scalar(select(Product.id)), name='Duplicate',
                                       sku='different-sku', price='10.00', public_id=public_id)
        db.add(duplicate)
        with pytest.raises(DBAPIError, match='public_id'):
            db.commit()
        db.rollback()
        assert db.scalar(select(model.public_id).where(model.id == identifier)) == public_id

    column = next(c for c in inspect(engine).get_columns(model.__tablename__) if c['name'] == 'public_id')
    assert str(column['type']) == 'UUID'
    assert column['nullable'] is False


def test_empty_migration_matches_metadata(postgres):
    engine, _ = postgres
    config = Config(str(Path(__file__).resolve().parents[1] / 'alembic.ini'))
    command.check(config)
    with engine.connect() as connection:
        for table in ('products', 'product_variants'):
            assert connection.execute(text(f'SELECT count(*) FROM {table}')).scalar_one() == 0


def test_failed_upgrade_rolls_back_and_can_be_retried(postgres):
    engine, _ = postgres
    config = Config(str(Path(__file__).resolve().parents[1] / 'alembic.ini'))
    command.downgrade(config, 'a7b8c9d0e1f2')
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO categories (name, slug) VALUES ('Legacy', 'legacy')"))
        connection.execute(text("INSERT INTO products (name, price, stock, category_id) "
                                "VALUES ('Legacy', 10, 7, 1)"))

    def fail_after_backfill(connection, cursor, statement, parameters, context, executemany):
        if 'CREATE TRIGGER products_public_id_immutable' in statement:
            raise RuntimeError('injected failure after backfill')

    event.listen(Engine, 'before_cursor_execute', fail_after_backfill)
    try:
        with pytest.raises(RuntimeError, match='injected failure'):
            command.upgrade(config, 'head')
    finally:
        event.remove(Engine, 'before_cursor_execute', fail_after_backfill)

    assert 'public_id' not in {c['name'] for c in inspect(engine).get_columns('products')}
    with engine.connect() as connection:
        assert connection.execute(text('SELECT version_num FROM alembic_version')).scalar_one() == 'a7b8c9d0e1f2'
        assert connection.execute(text('SELECT stock FROM products WHERE id = 1')).scalar_one() == 7
    command.upgrade(config, 'head')
    with engine.connect() as connection:
        assert isinstance(connection.execute(text('SELECT public_id FROM products WHERE id = 1')).scalar_one(), UUID)
        assert connection.execute(text('SELECT stock FROM products WHERE id = 1')).scalar_one() == 7
