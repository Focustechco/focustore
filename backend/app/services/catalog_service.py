"""Read catalog use cases; keep storage failures out of HTTP responses."""
from decimal import InvalidOperation
from pathlib import Path
from sqlite3 import Error as SQLiteError
from typing import Protocol

from app.schemas.catalog import CatalogCategory, CatalogPage, CatalogProduct


class CatalogRepository(Protocol):
    def products(self, offset: int, limit: int) -> CatalogPage[CatalogProduct]: ...
    def product(self, slug: str) -> CatalogProduct | None: ...
    def categories(self, offset: int, limit: int) -> CatalogPage[CatalogCategory]: ...


class CatalogUnavailable(Exception):
    pass


class CatalogService:
    def __init__(self, repository: CatalogRepository) -> None:
        self.repository = repository

    @classmethod
    def from_path(cls, path: Path | None, excluded_slugs: list[str] | None = None) -> 'CatalogService':
        from app.integrations.legacy_catalog.repository import LegacyCatalogRepository

        if path is None:
            raise CatalogUnavailable
        return cls(LegacyCatalogRepository(path, excluded_slugs or []))

    def products(self, offset: int, limit: int) -> CatalogPage[CatalogProduct]:
        try:
            return self.repository.products(offset, limit)
        except (SQLiteError, OSError, ValueError, InvalidOperation) as exc:
            raise CatalogUnavailable from exc

    def product(self, slug: str) -> CatalogProduct | None:
        try:
            return self.repository.product(slug)
        except (SQLiteError, OSError, ValueError, InvalidOperation) as exc:
            raise CatalogUnavailable from exc

    def categories(self, offset: int, limit: int) -> CatalogPage[CatalogCategory]:
        try:
            return self.repository.categories(offset, limit)
        except (SQLiteError, OSError, ValueError, InvalidOperation) as exc:
            raise CatalogUnavailable from exc
