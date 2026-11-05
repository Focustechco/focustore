from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.db.dependencies import get_db
from app.main import create_app
from app.models import Product


@pytest.fixture
def postgres(monkeypatch, isolated_settings):
    raw = os.environ.get("TEST_DATABASE_URL")
    if not raw:
        pytest.skip("Set TEST_DATABASE_URL to a temporary local PostgreSQL database")
    url = make_url(raw)
    assert url.get_backend_name() == "postgresql"
    assert url.host in {"127.0.0.1", "localhost", "::1"}
    assert url.database == "focusstore_test"
    admin = create_engine(url, hide_parameters=True)
    schema = "product_flow_" + uuid4().hex
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    test_url = url.update_query_dict({"options": f"-csearch_path={schema}"})
    monkeypatch.setenv("DATABASE_URL", test_url.render_as_string(hide_password=False))
    from app.config import get_settings

    get_settings.cache_clear()
    engine = create_engine(test_url, hide_parameters=True)
    try:
        command.upgrade(Config(str(Path(__file__).resolve().parents[1] / "alembic.ini")), "head")
        yield engine, test_url
    finally:
        engine.dispose()
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()
        get_settings.cache_clear()


def _client(engine, monkeypatch):
    monkeypatch.setenv("CATALOG_SOURCE", "postgresql")
    from app.config import get_settings

    get_settings.cache_clear()
    sessions = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    application = create_app()

    def override_get_db():
        db = sessions()
        try:
            yield db
        finally:
            db.close()

    application.dependency_overrides[get_db] = override_get_db
    client = TestClient(application)
    client.cookies.set("focus_session", "admin-token")
    client.headers["origin"] = "http://testserver"
    return client, sessions


def test_product_slug_flow_against_isolated_postgres(postgres, identity_source, monkeypatch):
    engine, _url = postgres
    monkeypatch.setenv("DATABASE_URL", _url.render_as_string(hide_password=False))
    client, sessions = _client(engine, monkeypatch)

    category = client.post("/categories", json={"name": "Teclados", "slug": "teclados"})
    assert category.status_code == 201
    category_id = category.json()["id"]

    first = client.post(
        "/products",
        json={"name": "Teclado Mecânico", "price": "199.90", "stock": 4, "category_id": category_id},
    )
    second = client.post(
        "/products",
        json={"name": "Teclado Mecânico", "price": "299.90", "stock": 2, "category_id": category_id},
    )
    assert first.status_code == 201 and second.status_code == 201

    with sessions() as db:
        created = db.query(Product).order_by(Product.id).all()
        assert [product.slug for product in created] == ["teclado-mecanico", "teclado-mecanico-2"]
        legacy = Product(name="Legado", price="10.00", stock=1, category_id=category_id, status="ACTIVE")
        db.add(legacy)
        db.commit()
        legacy_id = legacy.id

    listed = client.get("/api/v1/catalog/products")
    assert listed.status_code == 200
    assert {item["slug"] for item in listed.json()["items"]} >= {"teclado-mecanico", "teclado-mecanico-2", f"legacy-product-{legacy_id}"}

    assert client.get("/api/v1/catalog/products/teclado-mecanico").status_code == 200
    assert client.get(f"/api/v1/catalog/products/legacy-product-{legacy_id}").status_code == 200
    assert client.get("/api/v1/catalog/products/does-not-exist").status_code == 404

    invalid = client.post(
        "/products",
        json={"name": "Inválido", "price": "0", "stock": 1, "category_id": category_id},
    )
    assert invalid.status_code == 422

    unauthenticated = TestClient(create_app()).post(
        "/products",
        json={"name": "Sem acesso", "price": "10.00", "stock": 1, "category_id": category_id},
    )
    assert unauthenticated.status_code == 401
