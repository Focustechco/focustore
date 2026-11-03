"""Stateless cart quote: client supplies only identifiers and quantities."""
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class CartLineInput(BaseModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True)
    variant_id: str = Field(alias='variantId', min_length=1, max_length=255)
    quantity: int = Field(gt=0, le=999, strict=True)


class CartQuoteInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    items: list[CartLineInput] = Field(max_length=100)


class QuotedLine(BaseModel):
    variant_id: str
    product_id: str
    product_name: str
    variant_name: str
    sku: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class CartQuote(BaseModel):
    items: list[QuotedLine]
    total_items: int
    subtotal: Decimal
    currency: str = 'BRL'
    reserves_stock: bool = False


class Availability(BaseModel):
    variant_id: str
    quantity_available: int
    available: bool
