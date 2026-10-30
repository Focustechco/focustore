"""Read-only database integrity checks. Run after Alembic migrations."""
from pathlib import Path

from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Integer, String, create_engine, inspect, text
from sqlalchemy.engine import make_url
from app.config import get_settings


def check_integrity(database_url: str | None = None) -> list[str]:
    url = make_url(database_url or get_settings().database_url)
    if url.get_backend_name() != 'postgresql':
        return ['Integrity agent requires PostgreSQL']
    engine = create_engine(url, pool_pre_ping=True, hide_parameters=True,
                           connect_args={'connect_timeout': 5})
    failures: list[str] = []
    try:
        with engine.connect() as connection, connection.begin():
            connection.execute(text('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY'))
            connection.execute(text("SET LOCAL statement_timeout = '15s'"))
            connection.execute(text("SET LOCAL lock_timeout = '3s'"))
            connection.execute(text('SELECT 1')).scalar_one()
            config = Config(str(Path(__file__).resolve().parents[2] / 'alembic.ini'))
            expected = set(ScriptDirectory.from_config(config).get_heads())
            actual = set(MigrationContext.configure(connection).get_current_heads())
            if actual != expected:
                failures.append('Alembic revisions do not match repository heads; review migrations')
            inspector = inspect(connection)
            if 'categories' not in inspector.get_table_names():
                failures.append('Missing categories table')
                return failures
            cols = {col['name'] for col in inspector.get_columns('categories')}
            if not {'id', 'name', 'slug'} <= cols:
                failures.append('Missing required columns in categories')
                return failures
            if inspector.get_pk_constraint('categories')['constrained_columns'] != ['id']:
                failures.append('Missing categories primary key on id')
            for col in inspector.get_columns('categories'):
                if col['name'] in {'id', 'name', 'slug'} and col['nullable']:
                    failures.append(f"categories.{col['name']} must be NOT NULL")
                if col['name'] == 'id' and not isinstance(col['type'], Integer):
                    failures.append('categories.id must use an integer type')
                if col['name'] in {'name', 'slug'}:
                    length = 120 if col['name'] == 'name' else 140
                    if not isinstance(col['type'], String) or col['type'].length != length:
                        failures.append(f"categories.{col['name']} must use VARCHAR({length})")
            unique = inspector.get_unique_constraints('categories') + inspector.get_indexes('categories')
            if not any(c['column_names'] == ['slug'] and c.get('unique', True)
                       and not c.get('dialect_options', {}).get('postgresql_where') for c in unique):
                failures.append('Missing unique constraint on categories.slug')
            checks = {
                'categories with empty name': "SELECT count(*) FROM categories WHERE name IS NULL OR btrim(name) = ''",
                'categories with empty slug': "SELECT count(*) FROM categories WHERE slug IS NULL OR btrim(slug) = ''",
                'duplicate category slugs': "SELECT count(*) FROM (SELECT slug FROM categories GROUP BY slug HAVING count(*) > 1) duplicates",
                'categories exceeding declared lengths': 'SELECT count(*) FROM categories WHERE length(name) > 120 OR length(slug) > 140',
            }
            for name, query in checks.items():
                count = connection.execute(text(query)).scalar_one()
                if count:
                    failures.append(f'{name}: {count}')
    finally:
        engine.dispose()
    return failures


def main() -> int:
    try:
        failures = check_integrity()
    except Exception as exc:
        # Exceptions may contain credentials or real data: log only their type.
        print(f'FAIL: integrity check could not complete ({type(exc).__name__}); check connectivity, permissions and schema')
        return 1
    if failures:
        for failure in failures:
            print(f'FAIL: {failure}')
        return 1
    print('PASS: PostgreSQL connectivity, Alembic heads, category schema and data integrity')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
