from io import StringIO
from pathlib import Path
from uuid import UUID

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from app.db.base import Base
from app import models  # noqa: F401


def test_category_registered():
    assert "categories" in Base.metadata.tables


def test_migrations_online_offline():
    from app.config import get_settings

    output = StringIO()
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"), output_buffer=output)
    # The public-ID revision deliberately needs an online transaction because
    # UUIDs are generated in Python while backfilling existing rows.
    command.upgrade(config, "a7b8c9d0e1f2", sql=True)
    assert "CREATE TABLE categories" in output.getvalue()
    command.upgrade(config, "head")
    command.check(config)
    engine = create_engine(get_settings().database_url)
    try:
        schema = inspect(engine)
        category_columns = {c["name"] for c in schema.get_columns("categories")}
        assert {"id", "name", "slug", "description", "image_url", "position", "is_active"}.issubset(category_columns)
        assert any(c["column_names"] == ["slug"] for c in schema.get_unique_constraints("categories"))
        assert {"product_images", "product_variants", "inventory", "product_categories"}.issubset(
            set(schema.get_table_names())
        )
        command.downgrade(config, "base")
        assert "categories" not in inspect(engine).get_table_names()
    finally:
        engine.dispose()


def test_public_ids_backfill_legacy_catalog_rows():
    from app.config import get_settings

    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    command.upgrade(config, "a7b8c9d0e1f2")
    engine = create_engine(get_settings().database_url)
    try:
        with engine.begin() as connection:
            connection.execute(text("INSERT INTO categories (name, slug) VALUES ('Legacy', 'legacy')"))
            connection.execute(text(
                "INSERT INTO products (name, price, stock, category_id) VALUES ('Legacy', 9.90, 2, 1)"
            ))
            connection.execute(text(
                "INSERT INTO product_variants (product_id, sku, name, price) "
                "VALUES (1, 'LEGACY-DEFAULT', 'Padrão', 9.90)"
            ))

        command.upgrade(config, "head")

        with engine.begin() as connection:
            product_id = connection.execute(text("SELECT public_id FROM products WHERE id = 1")).scalar_one()
            variant_id = connection.execute(
                text("SELECT public_id FROM product_variants WHERE id = 1")
            ).scalar_one()
            assert UUID(str(product_id))
            assert UUID(str(variant_id))
            assert product_id != variant_id
    finally:
        engine.dispose()
