from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FocusStore API"
    app_version: str = "0.1.0"
    debug: bool = Field(default=False, validation_alias="FOCUS_DEBUG")
    database_url: str = Field(min_length=1)
    legacy_catalog_sqlite_path: Path | None = None

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
