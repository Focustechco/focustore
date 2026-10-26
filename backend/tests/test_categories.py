import pytest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.db.dependencies import get_db
from app.models.category import Category


@pytest.fixture
def client(tmp_path, isolated_settings):
    from app.main import app

    database_file = tmp_path / "categories_test.db"

    engine = create_engine(
        f"sqlite:///{database_file.as_posix()}",
        connect_args={"check_same_thread": False},
    )

    Base.metadata.create_all(bind=engine)

    TestingSessionLocal = sessionmaker(
        bind=engine,
        autoflush=False,
        expire_on_commit=False,
    )

    def override_get_db():
        db = TestingSessionLocal()

        try:
            yield db
        finally:
            db.close()

    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        if previous_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override

        engine.dispose()


def test_create_category_success(client):
    response = client.post(
        "/categories",
        json={
            "name": "Eletrônicos",
            "slug": "eletronicos",
        },
    )

    assert response.status_code == 201

    data = response.json()

    assert isinstance(data["id"], int)
    assert data["name"] == "Eletrônicos"
    assert data["slug"] == "eletronicos"


def test_create_category_duplicate_slug(client):
    category = {
        "name": "Eletrônicos",
        "slug": "eletronicos",
    }

    first_response = client.post("/categories", json=category)

    assert first_response.status_code == 201

    second_response = client.post("/categories", json=category)

    assert second_response.status_code == 409
    assert second_response.json()["detail"] == (
        "Já existe uma categoria com esse slug."
    )


def test_create_category_invalid_data(client):
    response = client.post(
        "/categories",
        json={
            "name": "",
            "slug": "",
        },
    )

    assert response.status_code == 422