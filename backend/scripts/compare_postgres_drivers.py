"""Compare direct psycopg and SQLAlchemy PostgreSQL connections safely.

This diagnostic is intentionally independent from local_validation.py. It uses
only PGHOST, PGPORT, PGUSER and PGDATABASE from the process environment, with
safe local-test defaults. DATABASE_URL and PGPASSWORD are deliberately ignored.
The password is requested once and retained only in process memory.
"""

from __future__ import annotations

import getpass
import os
from typing import Any


EXPECTED_HOST = "127.0.0.1"
EXPECTED_PORT = 5432
EXPECTED_USER = "postgres"
EXPECTED_DATABASE = "focusstore_test"


def connection_parameters() -> dict[str, Any]:
    """Read non-secret process settings and reject non-local destinations."""
    host = os.environ.get("PGHOST", EXPECTED_HOST)
    port_text = os.environ.get("PGPORT", str(EXPECTED_PORT))
    user = os.environ.get("PGUSER", EXPECTED_USER)
    database = os.environ.get("PGDATABASE", EXPECTED_DATABASE)
    try:
        port = int(port_text)
    except ValueError as exc:
        raise ValueError("PGPORT inválido") from exc

    if (host, port, user, database) != (
        EXPECTED_HOST,
        EXPECTED_PORT,
        EXPECTED_USER,
        EXPECTED_DATABASE,
    ):
        raise ValueError("o destino não corresponde ao PostgreSQL local autorizado")
    return {"host": host, "port": port, "user": user, "database": database}


def exception_metadata(exc: BaseException) -> tuple[str, str]:
    """Return only exception class and SQLSTATE, never raw exception text."""
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
    safe_sqlstate = sqlstate if isinstance(sqlstate, str) and sqlstate.isalnum() else "indisponível"
    return type(driver_exception).__name__, safe_sqlstate


def report_failure(driver: str, exc: BaseException) -> None:
    exception_class, sqlstate = exception_metadata(exc)
    print(f"{driver}: FALHA; excecao={exception_class}; sqlstate={sqlstate}")


def direct_psycopg(parameters: dict[str, Any], password: str) -> bool:
    import psycopg

    connection = None
    try:
        connection = psycopg.connect(
            host=parameters["host"],
            port=parameters["port"],
            user=parameters["user"],
            dbname=parameters["database"],
            password=password,
            connect_timeout=5,
        )
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
        if result != (1,):
            print("psycopg: FALHA; resultado_select_1=inesperado")
            return False
        print("psycopg: SUCESSO; select_1=1")
        return True
    except Exception as exc:
        report_failure("psycopg", exc)
        return False
    finally:
        if connection is not None:
            connection.close()


def sqlalchemy_connection(parameters: dict[str, Any], password: str) -> bool:
    from sqlalchemy import create_engine, text
    from sqlalchemy.engine import URL

    engine = None
    try:
        url = URL.create(
            drivername="postgresql+psycopg",
            username=parameters["user"],
            password=password,
            host=parameters["host"],
            port=parameters["port"],
            database=parameters["database"],
        )
        engine = create_engine(
            url,
            hide_parameters=True,
            connect_args={"connect_timeout": 5},
        )
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1")).scalar_one()
        if result != 1:
            print("sqlalchemy: FALHA; resultado_select_1=inesperado")
            return False
        print("sqlalchemy: SUCESSO; select_1=1")
        return True
    except Exception as exc:
        report_failure("sqlalchemy", exc)
        return False
    finally:
        if engine is not None:
            engine.dispose()


def main() -> int:
    try:
        parameters = connection_parameters()
    except ValueError:
        print("configuracao: FALHA; destino_nao_autorizado")
        return 2

    password = getpass.getpass("Senha PostgreSQL local (não será exibida): ")
    try:
        psycopg_ok = direct_psycopg(parameters, password)
        sqlalchemy_ok = sqlalchemy_connection(parameters, password)
    finally:
        password = None

    return 0 if psycopg_ok and sqlalchemy_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
