from __future__ import annotations

import pytest

from scripts import local_validation


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
