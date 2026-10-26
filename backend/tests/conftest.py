import pytest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.db.dependencies import get_db


@pytest.fixture(autouse=True)
def isolated_settings(monkeypatch, tmp_path):
    from app.config import Settings, get_settings

    monkeypatch.setenv("DEBUG", "release")
    monkeypatch.setenv("FOCUS_DEBUG", "false")
    monkeypatch.setenv("APP_NAME", "FocusStore API")
    monkeypatch.setenv("APP_VERSION", "0.1.0")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{(tmp_path / 'test.db').as_posix()}")
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


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


