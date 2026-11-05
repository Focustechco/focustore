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
import ipaddress
import sys
from pathlib import Path
from typing import Any


EXPECTED_HOST = "127.0.0.1"
EXPECTED_PORT = 5432
EXPECTED_DATABASE = "focusstore_test"
EXPECTED_USER = "postgres"
EXPECTED_HEAD = "a7b8c9d0e1f2"
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


def failure_message(exc: BaseException) -> str:
    """Return a useful failure category without exposing driver details."""
    if isinstance(exc, ValidationError):
        return str(exc)
    if isinstance(exc, (EOFError, KeyboardInterrupt)):
        return "entrada da senha cancelada."

    from alembic.util.exc import CommandError
    from sqlalchemy.exc import ArgumentError, NoSuchModuleError, OperationalError
    from sqlalchemy.exc import ProgrammingError, SQLAlchemyError

    if isinstance(exc, PermissionError):
        return "permissão insuficiente para acessar o recurso local."
    if isinstance(exc, (NoSuchModuleError, ArgumentError)):
        return "configuração inválida do SQLAlchemy ou do driver PostgreSQL."
    is_driver_operational_error = (
        type(exc).__name__ in {"OperationalError", "InterfaceError"}
        and type(exc).__module__.startswith("psycopg")
    )
    if isinstance(exc, OperationalError) or is_driver_operational_error:
        detail = str(getattr(exc, "orig", exc)).lower()
        if any(token in detail for token in ("permission denied", "insufficient privilege")):
            return "permissão insuficiente no PostgreSQL local para consultar o schema."
        if any(token in detail for token in (
            "password authentication failed",
            "no password supplied",
            "authentication failed",
            "invalid password",
            "role ",
        )):
            return "falha de autenticação no PostgreSQL local; a senha ou o usuário não foram aceitos."
        if any(token in detail for token in (
            "connection refused",
            "could not connect",
            "connection timed out",
            "timeout expired",
            "server closed the connection",
        )):
            return "falha de conexão com o PostgreSQL local; confirme serviço, host e porta."
        return "falha operacional ao acessar o PostgreSQL local."
    if isinstance(exc, ProgrammingError):
        detail = str(getattr(exc, "orig", exc)).lower()
        if any(token in detail for token in ("permission denied", "insufficient privilege")):
            return "permissão insuficiente no PostgreSQL local para consultar o schema."
        return "erro SQL ou schema incompatível no PostgreSQL local."
    if isinstance(exc, CommandError):
        return "erro do Alembic ao ler ou aplicar a cadeia de migrations."
    if isinstance(exc, SQLAlchemyError):
        return "erro do SQLAlchemy ao acessar o PostgreSQL local."
    if isinstance(exc, OSError):
        return "erro do sistema ao acessar um recurso local."
    return "erro inesperado durante a validação; detalhes sensíveis foram omitidos."


def inspection_failure(stage: str, exc: BaseException) -> ValidationError:
    """Attach a safe inspection stage to a sanitized driver error."""
    return ValidationError(f"Falha na etapa {stage}: {failure_message(exc)}")


def identity_mismatches(identity: tuple[Any, Any, Any, Any, Any]) -> list[str]:
    """Return safe names of identity fields that do not match the local target."""
    database, user, host, port, _version = identity
    mismatches: list[str] = []
    try:
        actual_host = ipaddress.ip_interface(host).ip if host is not None else None
        expected_host = ipaddress.ip_address(EXPECTED_HOST)
        if isinstance(actual_host, ipaddress.IPv6Address) and actual_host.ipv4_mapped:
            actual_host = actual_host.ipv4_mapped
        host_matches = actual_host == expected_host
    except ValueError:
        host_matches = False
    if not host_matches:
        mismatches.append("host")
    if port != EXPECTED_PORT:
        mismatches.append("porta")
    if database != EXPECTED_DATABASE:
        mismatches.append("banco")
    if user != EXPECTED_USER:
        mismatches.append("usuário")
    return mismatches


def safe_exception_details(exc: BaseException) -> str:
    """Return non-sensitive exception metadata for troubleshooting."""
    candidates = [exc, getattr(exc, "orig", None), getattr(exc, "__cause__", None)]
    driver_exception = next(
        (
            candidate
            for candidate in candidates
            if candidate is not None and type(candidate).__module__.startswith("psycopg")
        ),
        exc,
    )
    sqlstate = getattr(driver_exception, "sqlstate", None) or getattr(driver_exception, "pgcode", None)
    driver = "psycopg" if type(driver_exception).__module__.startswith("psycopg") else "sqlalchemy"
    sqlstate_text = sqlstate if isinstance(sqlstate, str) and sqlstate.isalnum() else "indisponível"
    return (
        f"exceção={type(driver_exception).__name__}; "
        f"driver={driver}; sqlstate={sqlstate_text}; "
        f"categoria={failure_message(exc)}"
    )


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
    try:
        identity = connection.execute(
            text(
                """
                SELECT current_database(), current_user, inet_server_addr()::text,
                       inet_server_port(), split_part(version(), ' ', 2)
                """
            )
        ).one()
    except Exception as exc:
        raise inspection_failure("identidade do servidor PostgreSQL", exc) from exc
    database, user, host, port, version = identity
    mismatches = identity_mismatches(identity)
    if mismatches:
        raise ValidationError(
            "A conexão efetiva não corresponde ao destino local autorizado; "
            "divergência em: " + ", ".join(mismatches) + "."
        )

    try:
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
    except Exception as exc:
        raise inspection_failure("inventário de tabelas públicas", exc) from exc
    unexpected = tables - ALLOWED_PUBLIC_TABLES
    if unexpected:
        raise ValidationError(
            "Existem tabelas públicas fora do catálogo autorizado: " + ", ".join(sorted(unexpected))
        )

    revisions_in_db: list[str] = []
    if "alembic_version" in tables:
        try:
            revisions_in_db = list(
                connection.execute(text("SELECT version_num FROM public.alembic_version ORDER BY version_num"))
                .scalars()
            )
        except Exception as exc:
            raise inspection_failure("leitura da revisão Alembic", exc) from exc
        if len(revisions_in_db) > 1 or any(revision not in revisions for revision in revisions_in_db):
            raise ValidationError("A revisão Alembic do banco não pertence à cadeia esperada.")
    elif tables:
        raise ValidationError("Há tabelas públicas, mas a tabela alembic_version não existe.")

    counts: dict[str, int] = {}
    for table in sorted(tables - {"alembic_version"}):
        try:
            counts[table] = int(connection.execute(text(f"SELECT count(*) FROM public.{table}")).scalar_one())
        except Exception as exc:
            raise inspection_failure(f"contagem da tabela pública {table}", exc) from exc

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
    stage = "inicialização"
    try:
        stage = "carregamento das dependências"
        ensure_backend_import_path()
        command, Config, ScriptDirectory, create_engine, text, URL = required_dependencies()
        stage = "verificação da cadeia Alembic"
        revisions, _ = migration_revisions(ScriptDirectory, Config)
        try:
            stage = "entrada interativa da senha"
            password = getpass.getpass("Senha do PostgreSQL local (não será exibida): ")
        except (EOFError, KeyboardInterrupt):
            print("Validação interrompida: entrada da senha cancelada.", file=sys.stderr)
            return 2
        stage = "construção da URL SQLAlchemy local"
        url = build_local_url(password, URL)
        stage = "criação do engine SQLAlchemy"
        engine = create_engine(url, pool_pre_ping=True, hide_parameters=True)
        try:
            stage = "abertura da conexão SQLAlchemy"
            with engine.connect() as connection:
                stage = "inspeção somente leitura do PostgreSQL"
                with connection.begin():
                    snapshot = inspect_database(connection, text, revisions)
                    report(snapshot)
                    if args.migrate:
                        if snapshot["counts"] and not args.allow_existing_data:
                            raise ValidationError(
                                "O banco autorizado já contém dados; revise as contagens e use "
                                "--allow-existing-data somente após confirmar que são dados de teste."
                            )
                        stage = "execução das migrations Alembic"
                        migrate(connection, command, Config)
            if args.migrate:
                stage = "reinspeção do PostgreSQL após migration"
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
        print(
            f"Validação interrompida na etapa {stage}: {failure_message(exc)} "
            f"({safe_exception_details(exc)})",
            file=sys.stderr,
        )
        return 2
    except Exception as exc:
        print(
            f"Validação interrompida na etapa {stage}: {failure_message(exc)} "
            f"({safe_exception_details(exc)})",
            file=sys.stderr,
        )
        return 1
    finally:
        password = None


if __name__ == "__main__":
    raise SystemExit(main())
