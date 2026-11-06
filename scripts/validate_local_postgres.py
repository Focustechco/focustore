"""Validate the explicitly approved local PostgreSQL destination.

The validator never prints the connection URL or exception text because either
can contain credentials or server details that should not reach the terminal.
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from ipaddress import IPv4Address, IPv6Address, ip_address, ip_interface

from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import ArgumentError, OperationalError, SQLAlchemyError


EXPECTED_HOST = "127.0.0.1"
EXPECTED_PORT = 5432
EXPECTED_DATABASE = "focusstore_test"
EXPECTED_USER = "postgres"
EXPECTED_SCHEMA = "public"


@dataclass(frozen=True)
class ValidationResult:
    ok: bool
    code: str
    message: str


def parse_local_url(raw: str) -> URL | ValidationResult:
    try:
        url = make_url(raw)
        port = url.port
    except (ArgumentError, TypeError, ValueError):
        return ValidationResult(False, "URL_INVALID", "A URL de conexão é inválida.")

    if url.get_backend_name() != "postgresql":
        return ValidationResult(False, "URL_INVALID", "A URL não usa PostgreSQL.")
    if url.host != EXPECTED_HOST or port != EXPECTED_PORT:
        return ValidationResult(False, "DESTINATION_REJECTED", "O host ou a porta não são os autorizados.")
    if url.database != EXPECTED_DATABASE or url.username != EXPECTED_USER:
        return ValidationResult(False, "DESTINATION_REJECTED", "O usuário ou o banco não são os autorizados.")
    return url


def classify_connection_error(error: BaseException) -> ValidationResult:
    detail = str(error).lower()
    if "password authentication failed" in detail or "no password supplied" in detail:
        return ValidationResult(False, "AUTHENTICATION_FAILED", "A senha do PostgreSQL foi rejeitada.")
    if "database" in detail and "does not exist" in detail:
        return ValidationResult(False, "DATABASE_NOT_FOUND", "O banco focusstore_test não existe.")
    if any(marker in detail for marker in (
        "connection refused", "could not connect", "connection timed out", "timeout expired",
        "server closed the connection", "could not translate host name", "name or service not known",
        "network is unreachable", "no route to host", "connection reset",
    )):
        return ValidationResult(False, "SERVER_UNAVAILABLE", "O servidor PostgreSQL local está indisponível.")
    if isinstance(error, SQLAlchemyError):
        return ValidationResult(False, "DATABASE_ERROR", "O PostgreSQL recusou a conexão ou a consulta.")
    return ValidationResult(False, "VALIDATOR_INTERNAL_ERROR", "O validador encontrou um erro interno.")


def normalize_address(value: object) -> str | None:
    """Normalize psycopg IP objects and PostgreSQL CIDR-like text safely."""
    if value is None:
        return None
    if isinstance(value, (IPv4Address, IPv6Address)):
        address = value
    else:
        raw = str(value).strip()
        try:
            address = ip_address(raw)
        except ValueError:
            try:
                address = ip_interface(raw).ip
            except ValueError:
                return None
    mapped = getattr(address, "ipv4_mapped", None)
    return str(mapped or address)


def validate_identity(
    database: object,
    server_address: object,
    client_address: object,
    port: object,
    user: object,
    schema: object,
) -> ValidationResult:
    """Validate server identity; client address only proves TCP was used."""
    normalized_server = normalize_address(server_address)
    normalized_client = normalize_address(client_address)
    if normalized_client is None:
        return ValidationResult(False, "DESTINATION_REJECTED", "A conexão não confirmou transporte TCP.")
    if normalized_server != EXPECTED_HOST:
        return ValidationResult(False, "DESTINATION_REJECTED", "O host efetivo do servidor não é 127.0.0.1.")
    if schema != EXPECTED_SCHEMA:
        return ValidationResult(False, "SCHEMA_VALIDATION_FAILED", "O schema efetivo não é public.")
    if database != EXPECTED_DATABASE:
        return ValidationResult(False, "DESTINATION_REJECTED", "O banco efetivo não é focusstore_test.")
    if port != EXPECTED_PORT:
        return ValidationResult(False, "DESTINATION_REJECTED", "A porta efetiva não é 5432.")
    if user != EXPECTED_USER:
        return ValidationResult(False, "DESTINATION_REJECTED", "O usuário efetivo não é postgres.")
    return ValidationResult(True, "OK", "PostgreSQL local validado: 127.0.0.1:5432/focusstore_test, schema public.")


def validate(raw: str) -> ValidationResult:
    parsed = parse_local_url(raw)
    if isinstance(parsed, ValidationResult):
        return parsed

    try:
        engine = create_engine(raw, hide_parameters=True, pool_pre_ping=True)
        with engine.connect() as connection:
            server_address, client_address, port, database, user, schema = connection.execute(text(
                "SELECT inet_server_addr(), inet_client_addr(), inet_server_port(), "
                "current_database(), current_user, current_schema()"
            )).one()
    except OperationalError as error:
        return classify_connection_error(error)
    except ArgumentError:
        return ValidationResult(False, "URL_INVALID", "A URL de conexão é inválida.")
    except SQLAlchemyError:
        return ValidationResult(False, "SCHEMA_VALIDATION_FAILED", "Não foi possível consultar a identidade do PostgreSQL.")
    except Exception:
        return ValidationResult(False, "VALIDATOR_INTERNAL_ERROR", "O validador encontrou um erro interno.")

    return validate_identity(database, server_address, client_address, port, user, schema)


def main() -> int:
    result = validate(os.environ.get("FOCUS_BACKEND_DATABASE_URL", ""))
    print(result.message if result.ok else f"[{result.code}] {result.message}", file=None if result.ok else sys.stderr)
    return 0 if result.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
