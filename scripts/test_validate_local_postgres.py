from ipaddress import IPv4Address

from sqlalchemy.exc import OperationalError

from validate_local_postgres import (
    classify_connection_error,
    parse_local_url,
    validate_identity,
    validate,
)


def test_accepts_local_url_with_special_password():
    parsed = parse_local_url("postgresql+psycopg://postgres:p%40ss%3Aword%25@127.0.0.1:5432/focusstore_test")
    assert not hasattr(parsed, "code")
    assert parsed.password == "p@ss:word%"


def test_rejects_remote_host_port_database_and_user():
    for raw in (
        "postgresql+psycopg://postgres@db.example:5432/focusstore_test",
        "postgresql+psycopg://postgres@127.0.0.1:5433/focusstore_test",
        "postgresql+psycopg://postgres@127.0.0.1:5432/other_test",
        "postgresql+psycopg://other@127.0.0.1:5432/focusstore_test",
    ):
        result = parse_local_url(raw)
        assert getattr(result, "code", None) == "DESTINATION_REJECTED"


def test_rejects_invalid_url():
    result = parse_local_url("not-a-database-url")
    assert result.code == "URL_INVALID"


def test_classifies_authentication_failure_without_exposing_details():
    result = classify_connection_error(OperationalError("password authentication failed for user postgres", {}, Exception()))
    assert result.code == "AUTHENTICATION_FAILED"
    assert "postgres" not in result.message


def test_classifies_server_and_database_failures():
    assert classify_connection_error(Exception("connection refused")).code == "SERVER_UNAVAILABLE"
    assert classify_connection_error(Exception('database "focusstore_test" does not exist')).code == "DATABASE_NOT_FOUND"


def test_unexpected_validator_error_is_internal():
    result = classify_connection_error(Exception("unexpected implementation failure"))
    assert result.code == "VALIDATOR_INTERNAL_ERROR"


def test_validate_does_not_connect_for_rejected_destination():
    result = validate("postgresql+psycopg://postgres@remote.example:5432/focusstore_test")
    assert result.code == "DESTINATION_REJECTED"


def test_accepts_ipv4_server_address_and_does_not_confuse_client_address():
    result = validate_identity("focusstore_test", "127.0.0.1", "10.20.30.40", 5432, "postgres", "public")
    assert result.ok


def test_accepts_ip_object_and_cidr_server_address():
    for server in (IPv4Address("127.0.0.1"), "127.0.0.1/32"):
        result = validate_identity("focusstore_test", server, "127.0.0.1/32", 5432, "postgres", "public")
        assert result.ok


def test_rejects_remote_server_even_when_client_is_local():
    result = validate_identity("focusstore_test", "10.0.0.5", "127.0.0.1", 5432, "postgres", "public")
    assert result.code == "DESTINATION_REJECTED"


def test_rejects_wrong_effective_port_database_user_and_schema():
    cases = (
        ("focusstore_test", "127.0.0.1", "127.0.0.1", 5433, "postgres", "public"),
        ("other_test", "127.0.0.1", "127.0.0.1", 5432, "postgres", "public"),
        ("focusstore_test", "127.0.0.1", "127.0.0.1", 5432, "other", "public"),
        ("focusstore_test", "127.0.0.1", "127.0.0.1", 5432, "postgres", "private"),
    )
    results = [validate_identity(*case) for case in cases]
    assert [result.code for result in results] == [
        "DESTINATION_REJECTED",
        "DESTINATION_REJECTED",
        "DESTINATION_REJECTED",
        "SCHEMA_VALIDATION_FAILED",
    ]
