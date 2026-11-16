from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FocusStore API"
    app_version: str = "0.1.0"
    debug: bool = Field(default=False, validation_alias="FOCUS_DEBUG")
    database_url: str = Field(min_length=1)
    legacy_catalog_sqlite_path: Path | None = None
    catalog_source: Literal['legacy_sqlite', 'postgresql'] = Field(
        default='legacy_sqlite', validation_alias='CATALOG_SOURCE'
    )
    fastapi_checkout_enabled: bool = Field(default=False, validation_alias='FASTAPI_CHECKOUT_ENABLED')
    checkout_write_authority: Literal['prisma', 'fastapi'] = Field(
        default='prisma', validation_alias='CHECKOUT_WRITE_AUTHORITY'
    )
    migration_mode: Literal['observe', 'shadow', 'cutover'] = Field(
        default='observe', validation_alias='MIGRATION_MODE'
    )
    fastapi_payment_simulator_enabled: bool = Field(
        default=False, validation_alias='FASTAPI_PAYMENT_SIMULATOR_ENABLED'
    )
    reservation_ttl_seconds: int = Field(default=900, validation_alias='RESERVATION_TTL_SECONDS', ge=1, le=86400)

    frontend_origin: str | None = None

    @field_validator('frontend_origin')
    @classmethod
    def validate_origin(cls, value: str | None) -> str | None:
        if value is None:
            return None
        from urllib.parse import urlsplit
        parsed = urlsplit(value)
        if (parsed.scheme not in {'http', 'https'} or not parsed.hostname
                or parsed.username or parsed.password or parsed.query or parsed.fragment
                or parsed.path not in {'', '/'}):
            raise ValueError('FRONTEND_ORIGIN must be a canonical HTTP(S) origin')
        # Accessing port validates malformed port values too.
        parsed.port
        return value.rstrip('/')

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        hide_input_in_errors=True,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
