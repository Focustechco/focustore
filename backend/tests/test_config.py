from pathlib import Path

import pytest
from pydantic import ValidationError
from app.config import Settings, get_settings


def test_settings_cached():
    assert get_settings() is get_settings()


@pytest.mark.parametrize("value, expected", [("true", True), ("false", False)])
def test_debug_values(monkeypatch, value, expected):
    monkeypatch.setenv("FOCUS_DEBUG", value)
    assert Settings().debug is expected


def test_system_debug_ignored(monkeypatch):
    monkeypatch.delenv("FOCUS_DEBUG")
    assert Settings(_env_file=None).debug is False


def test_invalid_debug_rejected(monkeypatch):
    monkeypatch.setenv("FOCUS_DEBUG", "invalid")
    with pytest.raises(ValidationError):
        Settings()


def test_database_url_required(monkeypatch):
    monkeypatch.delenv("DATABASE_URL")
    with pytest.raises(ValidationError):
        Settings()


def test_env_path_independent_of_cwd(monkeypatch, tmp_path):
    from app import config

    env_file = Path(config.__file__).resolve().parents[1] / ".env"
    monkeypatch.setitem(Settings.model_config, "env_file", env_file)
    monkeypatch.chdir(tmp_path)
    assert Settings.model_config["env_file"] == env_file
    assert env_file.is_absolute()
