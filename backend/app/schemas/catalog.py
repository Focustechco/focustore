"""Public read contract. External IDs never refer to PostgreSQL integer IDs."""
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, BeforeValidator, Field
from app.schemas.catalog_money import money

CatalogMoney = Annotated[Decimal, BeforeValidator(money), Field(ge=0, max_digits=10, decimal_places=2)]


CatalogSort = Literal['relevance', 'price_asc', 'price_desc', 'newest']


class CatalogImage(BaseModel):
    id: str
    url: str
    alt_text: str | None
    position: int
    is_primary: bool


class CatalogCategory(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None
    image_url: str | None
    parent_id: str | None
    position: int


class CatalogVariant(BaseModel):
    id: str
    public_id: UUID | None = None
    sku: str
    name: str
    color: str | None
    color_hex: str | None
    size: str | None
    model: str | None
    price: CatalogMoney
    promotional_price: CatalogMoney | None
    image_url: str | None
    position: int
    quantity_available: int | None = Field(ge=0)
    quantity_reserved: int | None = Field(ge=0)
    available: bool


class CatalogProduct(BaseModel):
    id: str
    catalog_origin: Literal['legacy_sqlite', 'postgresql'] | None = None
    currency: Literal['BRL'] = 'BRL'
    public_id: UUID | None = None
    name: str
    slug: str
    sku: str
    description: str
    short_description: str | None
    brand: str
    status: str
    base_price: CatalogMoney
    promotional_price: CatalogMoney | None
    available: bool
    primary_image: CatalogImage | None
    images: list[CatalogImage]
    categories: list[CatalogCategory]
    variants: list[CatalogVariant]


class CatalogPage[T](BaseModel):
    contract_version: Literal['1.1'] = '1.1'
    items: list[T]
    total: int
    offset: int
    limit: int
