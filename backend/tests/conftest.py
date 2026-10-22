import pytest


@pytest.fixture(autouse=True)
def isolated_settings(monkeypatch, tmp_path):
    """Never load local database credentials or inherited application settings."""
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
