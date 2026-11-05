from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest
from alembic.util.exc import CommandError
from psycopg import OperationalError as PsycopgOperationalError
from sqlalchemy.exc import ArgumentError, OperationalError, ProgrammingError

from scripts import local_validation


def test_product_model_declares_base_price_constraint():
    from app.models import Product

    constraints = {
        constraint.name: str(constraint.sqltext)
        for constraint in Product.__table__.constraints
        if constraint.name == "ck_products_base_price_nonnegative"
    }

    assert constraints == {
        "ck_products_base_price_nonnegative": "base_price IS NULL OR base_price >= 0"
    }


def test_latest_migration_adds_only_base_price_constraint():
    path = (
        Path(__file__).resolve().parents[1]
        / "migrations"
        / "versions"
        / "a7b8c9d0e1f2_add_product_base_price_constraint.py"
    )
    spec = importlib.util.spec_from_file_location("base_price_migration", path)
    assert spec is not None and spec.loader is not None
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)

    assert migration.revision == "a7b8c9d0e1f2"
    assert migration.down_revision == "f4a1d2e3c4b5"
    source = path.read_text(encoding="utf-8")
    assert source.count("ck_products_base_price_nonnegative") >= 4
    assert "op.create_check_constraint" in source
    assert "op.drop_constraint" in source
    assert "op.create_table" not in source
    assert "op.add_column" not in source
    assert "op.drop_table" not in source


class Result:
    def __init__(self, *, one=None, scalars=None, scalar_one=None):
        self._one = one
        self._scalars = scalars
        self._scalar_one = scalar_one

    def one(self):
        return self._one

    def scalars(self):
        return iter(self._scalars or [])

    def scalar_one(self):
        return self._scalar_one


class Connection:
    def __init__(self, results):
        self.results = iter(results)

    def execute(self, statement):
        return next(self.results)


def test_build_local_url_uses_fixed_local_destination_without_interpolation():
    class URL:
        @staticmethod
        def create(**kwargs):
            return kwargs

    result = local_validation.build_local_url("p@ss:with/slashes", URL)

    assert result == {
        "drivername": "postgresql+psycopg",
        "username": "postgres",
        "password": "p@ss:with/slashes",
        "host": "127.0.0.1",
        "port": 5432,
        "database": "focusstore_test",
    }


def test_inspect_database_returns_metadata_and_counts_without_reading_rows():
    connection = Connection([
        Result(one=("focusstore_test", "postgres", "127.0.0.1", 5432, "18.6")),
        Result(scalars=["alembic_version", "categories", "products"]),
        Result(scalars=["e0dd9a760a45"]),
        Result(scalar_one=2),
        Result(scalar_one=3),
    ])

    snapshot = local_validation.inspect_database(
        connection,
        lambda query: query,
        {"e0dd9a760a45", local_validation.EXPECTED_HEAD},
    )

    assert snapshot["database"] == "focusstore_test"
    assert snapshot["tables"] == ["alembic_version", "categories", "products"]
    assert snapshot["counts"] == {"categories": 2, "products": 3}


@pytest.mark.parametrize(
    "identity",
    [
        ("supabase", "postgres", "127.0.0.1", 5432, "18.6"),
        ("focusstore_test", "postgres", "10.0.0.5", 5432, "18.6"),
        ("focusstore_test", "postgres", "127.0.0.1", 5433, "18.6"),
    ],
)
def test_inspect_database_rejects_non_local_identity(identity):
    connection = Connection([Result(one=identity)])

    with pytest.raises(local_validation.ValidationError):
        local_validation.inspect_database(connection, lambda query: query, {local_validation.EXPECTED_HEAD})


def test_inspect_database_rejects_unexpected_public_tables():
    connection = Connection([
        Result(one=("focusstore_test", "postgres", "127.0.0.1", 5432, "18.6")),
        Result(scalars=["alembic_version", "users"]),
    ])

    with pytest.raises(local_validation.ValidationError):
        local_validation.inspect_database(connection, lambda query: query, {local_validation.EXPECTED_HEAD})


@pytest.mark.parametrize(
    ("identity", "expected"),
    [
        (("focusstore_test", "postgres", "127.0.0.1", 5432, "18.6"), []),
        (("focusstore_test", "postgres", "127.0.0.1/32", 5432, "18.6"), []),
        (("focusstore_test", "postgres", "127.0.0.1", 5433, "18.6"), ["porta"]),
        (("other_db", "postgres", "127.0.0.1", 5432, "18.6"), ["banco"]),
        (("focusstore_test", "other_user", "127.0.0.1", 5432, "18.6"), ["usuário"]),
        (("focusstore_test", "postgres", "::1", 5432, "18.6"), ["host"]),
        (("focusstore_test", "postgres", "::1/128", 5432, "18.6"), ["host"]),
        (("focusstore_test", "postgres", "::ffff:127.0.0.1", 5432, "18.6"), []),
        (("focusstore_test", "postgres", None, 5432, "18.6"), ["host"]),
    ],
)
def test_identity_mismatches_identifies_only_unauthorized_fields(identity, expected):
    assert local_validation.identity_mismatches(identity) == expected


def test_inspect_database_reports_safe_identity_stage_on_driver_failure():
    class FailingConnection:
        def execute(self, statement):
            raise PsycopgOperationalError("password authentication failed for secret")

    with pytest.raises(local_validation.ValidationError) as error:
        local_validation.inspect_database(FailingConnection(), lambda query: query, {local_validation.EXPECTED_HEAD})

    assert "identidade do servidor PostgreSQL" in str(error.value)
    assert "secret" not in str(error.value)


def test_safe_exception_details_exposes_only_driver_metadata():
    details = local_validation.safe_exception_details(PsycopgOperationalError("secret-password"))

    assert "driver=psycopg" in details
    assert "exceção=OperationalError" in details
    assert "secret-password" not in details


@pytest.mark.parametrize(
    ("error", "expected"),
    [
        (
            OperationalError("SELECT secret", {}, Exception("password authentication failed")),
            "falha de autenticação",
        ),
        (PsycopgOperationalError("no password supplied"), "falha de autenticação"),
        (
            OperationalError("SELECT secret", {}, Exception("connection refused")),
            "falha de conexão",
        ),
        (ArgumentError("invalid postgresql://user:secret@host URL"), "configuração inválida"),
        (
            ProgrammingError("SELECT secret", {}, Exception("permission denied for table users")),
            "permissão insuficiente",
        ),
        (CommandError("migration failed for secret"), "erro do Alembic"),
    ],
)
def test_failure_message_classifies_errors_without_exposing_details(error, expected):
    message = local_validation.failure_message(error)

    assert expected in message
    assert "secret" not in message
