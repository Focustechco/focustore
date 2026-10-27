"""Public read contract. External IDs never refer to PostgreSQL integer IDs."""
from decimal import Decimal

from pydantic import BaseModel, Field


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
    sku: str
    name: str
    color: str | None
    color_hex: str | None
    size: str | None
    model: str | None
    price: Decimal = Field(ge=0)
    promotional_price: Decimal | None = Field(ge=0)
    image_url: str | None
    position: int
    quantity_available: int | None = Field(ge=0)
    quantity_reserved: int | None = Field(ge=0)
    available: bool


class CatalogProduct(BaseModel):
    id: str
    name: str
    slug: str
    sku: str
    description: str
    short_description: str | None
    brand: str
    status: str
    base_price: Decimal = Field(ge=0)
    promotional_price: Decimal | None = Field(ge=0)
    available: bool
    primary_image: CatalogImage | None
    images: list[CatalogImage]
    categories: list[CatalogCategory]
    variants: list[CatalogVariant]


class CatalogPage[T](BaseModel):
    items: list[T]
    total: int
    offset: int
    limit: int
