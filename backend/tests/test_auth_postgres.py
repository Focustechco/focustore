from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.db.dependencies import get_db
from app.main import create_app
from app.models.user import User, UserSession


@pytest.fixture
def postgres_auth(monkeypatch):
    raw = os.environ.get("TEST_DATABASE_URL")
    if not raw:
        pytest.skip("Set TEST_DATABASE_URL to the authorized local focusstore_test database")
    url = make_url(raw)
    assert url.get_backend_name() == "postgresql"
    assert url.host in {"127.0.0.1", "localhost", "::1"}
    assert url.database == "focusstore_test"

    admin = create_engine(url, hide_parameters=True)
    schema = "auth_test_" + uuid4().hex
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))

    test_url = url.update_query_dict({"options": f"-csearch_path={schema}"})
    monkeypatch.setenv("DATABASE_URL", test_url.render_as_string(hide_password=False))
    from app.config import get_settings

    get_settings.cache_clear()
    engine = create_engine(test_url, hide_parameters=True)
    try:
        migration_config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
        command.upgrade(migration_config, "head")
        sessions = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
        application = create_app()

        def override_get_db():
            db = sessions()
            try:
                yield db
            finally:
                db.close()

        application.dependency_overrides[get_db] = override_get_db
        with TestClient(application) as client:
            client.headers["origin"] = "http://testserver"
            yield client, sessions, engine, migration_config
    finally:
        engine.dispose()
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()
        get_settings.cache_clear()


def test_customer_auth_flow_against_isolated_postgres(postgres_auth):
    client, sessions, _engine, _migration_config = postgres_auth
    registration = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Postgres Customer",
            "email": "postgres-customer@example.test",
            "password": "Strong-password-123",
        },
    )
    assert registration.status_code == 201
    token = registration.cookies.get("focus_session")
    assert token and token.startswith("pg_")
    client.cookies.set("focus_session", token)

    with sessions() as db:
        user = db.scalar(select(User).where(User.email == "postgres-customer@example.test"))
        assert user is not None
        assert user.password_hash.startswith("$argon2id$")
        assert user.role == "CUSTOMER"
        assert db.scalar(select(UserSession).where(UserSession.user_id == user.id)) is not None

    assert client.get("/api/v1/users/me").status_code == 200
    assert client.post("/api/v1/auth/logout").status_code == 204
    assert client.get("/api/v1/users/me").status_code == 401

    client.cookies.clear()
    login = client.post(
        "/api/v1/auth/login",
        json={
            "email": "postgres-customer@example.test",
            "password": "Strong-password-123",
        },
    )
    assert login.status_code == 200
    login_token = login.cookies.get("focus_session")
    assert login_token and login_token.startswith("pg_")
    client.cookies.set("focus_session", login_token)
    assert client.get("/api/v1/users/me").status_code == 200


def test_customer_identity_migration_round_trip_in_isolated_postgres(postgres_auth):
    _client, _sessions, engine, migration_config = postgres_auth
    command.downgrade(migration_config, "a7b8c9d0e1f2")
    tables = set(inspect(engine).get_table_names())
    assert {"users", "user_sessions", "auth_rate_limits"}.isdisjoint(tables)
    command.upgrade(migration_config, "head")
    tables = set(inspect(engine).get_table_names())
    assert {"users", "user_sessions", "auth_rate_limits"}.issubset(tables)
