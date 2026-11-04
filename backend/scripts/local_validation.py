"""Safely inspect and optionally migrate the local FocusStore PostgreSQL test DB.

This tool deliberately does not read ``backend/.env``. That file may contain a
shared Supabase URL. The only accepted destination is the local database
``focusstore_test`` on ``127.0.0.1:5432``.

Examples (run from the repository root):

    backend\\.venv\\Scripts\\python.exe backend\\scripts\\local_validation.py
    backend\\.venv\\Scripts\\python.exe backend\\scripts\\local_validation.py --migrate --confirm-migrations

The password is requested without echo and is held only in process memory. It
is never placed in a command-line argument, environment variable, file, or
report.
"""

from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path
from typing import Any


EXPECTED_HOST = "127.0.0.1"
EXPECTED_PORT = 5432
EXPECTED_DATABASE = "focusstore_test"
EXPECTED_USER = "postgres"
EXPECTED_HEAD = "f4a1d2e3c4b5"
ALLOWED_PUBLIC_TABLES = {
    "alembic_version",
    "categories",
    "products",
    "product_categories",
    "product_images",
    "product_variants",
    "inventory",
}


class ValidationError(RuntimeError):
    """A safe validation failure that contains no credentials."""


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def ensure_backend_import_path() -> None:
    backend_root = str(project_root() / "backend")
    if backend_root not in sys.path:
        sys.path.insert(0, backend_root)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--migrate",
        action="store_true",
        help="apply Alembic migrations after destination and schema checks",
    )
    parser.add_argument(
        "--confirm-migrations",
        action="store_true",
        help="required together with --migrate; confirms writes are limited to focusstore_test",
    )
    parser.add_argument(
        "--allow-existing-data",
        action="store_true",
        help="required to migrate when the authorized test database already contains rows",
    )
    args = parser.parse_args()
    if args.confirm_migrations and not args.migrate:
        parser.error("--confirm-migrations requires --migrate")
    if args.migrate and not args.confirm_migrations:
        parser.error("--migrate requires --confirm-migrations")
    if args.allow_existing_data and not args.migrate:
        parser.error("--allow-existing-data requires --migrate")
    return args


def required_dependencies() -> tuple[Any, Any, Any, Any, Any, Any]:
    try:
        from alembic import command
        from alembic.config import Config
        from alembic.script import ScriptDirectory
        from sqlalchemy import create_engine, text
        from sqlalchemy.engine import URL
    except ImportError as exc:
        raise ValidationError(
            "Dependências ausentes. Instale requirements.txt no backend/.venv antes da validação."
        ) from exc
    return command, Config, ScriptDirectory, create_engine, text, URL


def build_local_url(password: str, URL: Any) -> Any:
    """Build a URL without manually interpolating or escaping the password."""
    return URL.create(
        drivername="postgresql+psycopg",
        username=EXPECTED_USER,
        password=password,
        host=EXPECTED_HOST,
        port=EXPECTED_PORT,
        database=EXPECTED_DATABASE,
    )


def migration_revisions(ScriptDirectory: Any, Config: Any) -> tuple[set[str], list[str]]:
    root = project_root()
    config = Config(str(root / "backend" / "alembic.ini"))
    scripts = ScriptDirectory.from_config(config)
    revisions = {script.revision for script in scripts.walk_revisions()}
    heads = list(scripts.get_heads())
    if heads != [EXPECTED_HEAD]:
        raise ValidationError("A cadeia Alembic não possui a revisão final esperada.")
    return revisions, heads


def inspect_database(connection: Any, text: Any, revisions: set[str]) -> dict[str, Any]:
    identity = connection.execute(
        text(
            """
            SELECT current_database(), current_user, inet_server_addr()::text,
                   inet_server_port(), split_part(version(), ' ', 2)
            """
        )
    ).one()
    database, user, host, port, version = identity
    if database != EXPECTED_DATABASE or user != EXPECTED_USER or host != EXPECTED_HOST or port != EXPECTED_PORT:
        raise ValidationError("A conexão efetiva não corresponde ao destino local autorizado.")

    tables = set(
        connection.execute(
            text(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name
                """
            )
        ).scalars()
    )
    unexpected = tables - ALLOWED_PUBLIC_TABLES
    if unexpected:
        raise ValidationError(
            "Existem tabelas públicas fora do catálogo autorizado: " + ", ".join(sorted(unexpected))
        )

    revisions_in_db: list[str] = []
    if "alembic_version" in tables:
        revisions_in_db = list(
            connection.execute(text("SELECT version_num FROM public.alembic_version ORDER BY version_num"))
            .scalars()
        )
        if len(revisions_in_db) > 1 or any(revision not in revisions for revision in revisions_in_db):
            raise ValidationError("A revisão Alembic do banco não pertence à cadeia esperada.")
    elif tables:
        raise ValidationError("Há tabelas públicas, mas a tabela alembic_version não existe.")

    counts: dict[str, int] = {}
    for table in sorted(tables - {"alembic_version"}):
        counts[table] = int(connection.execute(text(f"SELECT count(*) FROM public.{table}")).scalar_one())

    return {
        "database": database,
        "user": user,
        "host": host,
        "port": port,
        "version": version,
        "tables": sorted(tables),
        "revisions": revisions_in_db,
        "counts": counts,
    }


def report(snapshot: dict[str, Any]) -> None:
    print("Destino PostgreSQL local validado: 127.0.0.1:5432/focusstore_test")
    print(f"Servidor: PostgreSQL {snapshot['version']}; usuário: {snapshot['user']}")
    print("Tabelas públicas: " + (", ".join(snapshot["tables"]) if snapshot["tables"] else "nenhuma"))
    print("Revisões Alembic: " + (", ".join(snapshot["revisions"]) if snapshot["revisions"] else "nenhuma"))
    if snapshot["counts"]:
        print("Contagens: " + ", ".join(f"{table}={count}" for table, count in snapshot["counts"].items()))


def migrate(connection: Any, command: Any, Config: Any) -> None:
    root = project_root()
    config = Config(str(root / "backend" / "alembic.ini"))
    config.attributes["connection"] = connection
    command.upgrade(config, "head")


def main() -> int:
    args = parse_args()
    try:
        ensure_backend_import_path()
        command, Config, ScriptDirectory, create_engine, text, URL = required_dependencies()
        revisions, _ = migration_revisions(ScriptDirectory, Config)
        password = getpass.getpass("Senha do PostgreSQL local (não será exibida): ")
        url = build_local_url(password, URL)
        engine = create_engine(url, pool_pre_ping=True, hide_parameters=True)
        try:
            with engine.begin() as connection:
                snapshot = inspect_database(connection, text, revisions)
                report(snapshot)
                if args.migrate:
                    if snapshot["counts"] and not args.allow_existing_data:
                        raise ValidationError(
                            "O banco autorizado já contém dados; revise as contagens e use "
                            "--allow-existing-data somente após confirmar que são dados de teste."
                        )
                    migrate(connection, command, Config)
            if args.migrate:
                with engine.connect() as connection:
                    final_snapshot = inspect_database(connection, text, revisions)
                print("Migrations concluídas no banco local autorizado.")
                report(final_snapshot)
            else:
                print("Modo somente leitura: nenhuma migration foi executada.")
        finally:
            engine.dispose()
        return 0
    except (ValidationError, OSError) as exc:
        print(f"Validação interrompida: {exc}", file=sys.stderr)
        return 2
    except Exception:
        print("Validação interrompida por erro inesperado; detalhes sensíveis foram omitidos.", file=sys.stderr)
        return 1
    finally:
        password = None


if __name__ == "__main__":
    raise SystemExit(main())
