"""Read catalog use cases; keep storage failures out of HTTP responses."""
from decimal import InvalidOperation
from pathlib import Path
from sqlite3 import Error as SQLiteError
from typing import Protocol

from sqlalchemy.exc import SQLAlchemyError

from app.schemas.catalog import CatalogCategory, CatalogPage, CatalogProduct


class CatalogRepository(Protocol):
    def products(self, offset: int, limit: int) -> CatalogPage[CatalogProduct]: ...
    def product(self, slug: str) -> CatalogProduct | None: ...
    def categories(self, offset: int, limit: int) -> CatalogPage[CatalogCategory]: ...
    def category(self, slug: str) -> CatalogCategory | None: ...


class CatalogUnavailable(Exception):
    pass


class CatalogService:
    def __init__(self, repository: CatalogRepository) -> None:
        self.repository = repository

    @classmethod
    def from_path(cls, path: Path | None) -> 'CatalogService':
        from app.integrations.legacy_catalog.repository import LegacyCatalogRepository

        if path is None:
            raise CatalogUnavailable
        return cls(LegacyCatalogRepository(path))

    @classmethod
    def from_settings(cls, settings, db=None) -> 'CatalogService':
        if settings.catalog_source == 'legacy_sqlite':
            return cls.from_path(settings.legacy_catalog_sqlite_path)
        if settings.catalog_source == 'postgresql':
            if db is None:
                raise CatalogUnavailable
            from app.integrations.postgres_catalog.repository import PostgresCatalogRepository

            return cls(PostgresCatalogRepository(db))
        raise CatalogUnavailable

    def products(self, offset: int, limit: int) -> CatalogPage[CatalogProduct]:
        try:
            return self.repository.products(offset, limit)
        except (SQLiteError, OSError, ValueError, InvalidOperation, SQLAlchemyError) as exc:
            raise CatalogUnavailable from exc

    def product(self, slug: str) -> CatalogProduct | None:
        try:
            return self.repository.product(slug)
        except (SQLiteError, OSError, ValueError, InvalidOperation, SQLAlchemyError) as exc:
            raise CatalogUnavailable from exc

    def categories(self, offset: int, limit: int) -> CatalogPage[CatalogCategory]:
        try:
            return self.repository.categories(offset, limit)
        except (SQLiteError, OSError, ValueError, InvalidOperation, SQLAlchemyError) as exc:
            raise CatalogUnavailable from exc

    def category(self, slug: str) -> CatalogCategory | None:
        try:
            return self.repository.category(slug)
        except (SQLiteError, OSError, ValueError, InvalidOperation, SQLAlchemyError) as exc:
            raise CatalogUnavailable from exc
