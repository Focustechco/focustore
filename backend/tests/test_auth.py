from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.db.base import Base
from app.db.dependencies import get_db
from app.main import create_app
from app.models.user import User, UserSession
from app.security.passwords import verify_password
from app.security.tokens import session_token_hash


@pytest.fixture
def auth_context(tmp_path, isolated_settings):
    engine = create_engine(f"sqlite:///{(tmp_path / 'auth.db').as_posix()}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    application = create_app()

    def override_get_db():
        db = sessions()
        try:
            yield db
        finally:
            db.close()

    application.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(application) as client:
            client.headers["origin"] = "http://testserver"
            yield client, sessions
    finally:
        application.dependency_overrides.clear()
        engine.dispose()


def _register(client, email="customer@example.test", password="Strong-password-123"):
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Customer", "email": email, "password": password},
    )
    if response.status_code == 201:
        token = response.cookies.get("focus_session")
        assert token and token.startswith("pg_")
        client.cookies.set("focus_session", token)
    return response


def test_register_hashes_password_and_sets_customer_cookie(auth_context):
    client, sessions = auth_context
    response = _register(client)

    assert response.status_code == 201
    assert response.json() == {
        "id": response.json()["id"],
        "name": "Customer",
        "email": "customer@example.test",
        "role": "CUSTOMER",
    }
    assert "password" not in response.text
    set_cookie = response.headers["set-cookie"].lower()
    assert "httponly" in set_cookie and "secure" in set_cookie and "samesite=lax" in set_cookie

    with sessions() as db:
        user = db.scalar(select(User).where(User.email == "customer@example.test"))
        assert user is not None
        assert user.password_hash.startswith("$argon2id$")
        assert verify_password("Strong-password-123", user.password_hash)
        assert user.role == "CUSTOMER"

    me = client.get("/api/v1/users/me")
    assert me.status_code == 200
    assert me.json()["email"] == "customer@example.test"


def test_duplicate_email_is_case_insensitive(auth_context):
    client, _ = auth_context
    assert _register(client, "User@Example.Test").status_code == 201
    client.cookies.clear()
    response = _register(client, " user@example.test ")
    assert response.status_code == 409


def test_login_invalid_is_generic_and_valid_session_persists(auth_context):
    client, sessions = auth_context
    assert _register(client).status_code == 201
    client.cookies.clear()

    invalid = client.post(
        "/api/v1/auth/login",
        json={"email": "customer@example.test", "password": "wrong-password"},
    )
    assert invalid.status_code == 401
    assert invalid.json() == {"detail": "Credenciais inválidas."}

    valid = client.post(
        "/api/v1/auth/login",
        json={"email": "customer@example.test", "password": "Strong-password-123"},
    )
    assert valid.status_code == 200
    token = valid.cookies.get("focus_session")
    assert token and token.startswith("pg_")
    client.cookies.set("focus_session", token)

    with sessions() as db:
        assert db.scalar(select(UserSession).where(UserSession.token_hash.is_not(None))) is not None
    assert client.get("/api/v1/users/me").status_code == 200


def test_logout_revokes_session_and_expired_session_is_rejected(auth_context):
    client, sessions = auth_context
    assert _register(client).status_code == 201

    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 204
    assert client.get("/api/v1/users/me").status_code == 401

    # A separately issued session remains persisted but expires server-side.
    client.cookies.clear()
    assert client.post(
        "/api/v1/auth/login",
        json={"email": "customer@example.test", "password": "Strong-password-123"},
    ).status_code == 200
    token = client.cookies.get("focus_session")
    assert token
    with sessions() as db:
        session = db.scalar(select(UserSession).where(UserSession.token_hash == session_token_hash(token)))
        session.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    client.cookies.set("focus_session", token)
    assert client.get("/api/v1/users/me").status_code == 401


def test_auth_mutations_require_origin_and_public_role_cannot_escalate(auth_context):
    client, _ = auth_context
    client.headers.pop("origin")
    assert _register(client).status_code == 403
    client.headers["origin"] = "http://testserver"
    response = _register(client)
    assert response.status_code == 201
    assert response.json()["role"] == "CUSTOMER"

    client.headers["origin"] = "https://evil.example"
    assert client.post("/api/v1/auth/logout").status_code == 403
