from io import StringIO
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect
from app.db.base import Base
from app import models  # noqa: F401


def test_category_registered():
    assert "categories" in Base.metadata.tables


def test_migrations_online_offline():
    from app.config import get_settings

    output = StringIO()
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"), output_buffer=output)
    command.upgrade(config, "head", sql=True)
    assert "CREATE TABLE categories" in output.getvalue()
    command.upgrade(config, "head")
    command.check(config)
    engine = create_engine(get_settings().database_url)
    try:
        schema = inspect(engine)
        assert {c["name"] for c in schema.get_columns("categories")} == {"id", "name", "slug"}
        assert any(c["column_names"] == ["slug"] for c in schema.get_unique_constraints("categories"))
        command.downgrade(config, "base")
        assert "categories" not in inspect(engine).get_table_names()
    finally:
        engine.dispose()
