"""Read contract for the current user's existing Prisma order snapshots."""
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class OrderSummary(BaseModel):
    id: str
    order_number: str
    status: str
    subtotal: Decimal = Field(ge=0)
    discount_amount: Decimal = Field(ge=0)
    shipping_amount: Decimal = Field(ge=0)
    total: Decimal = Field(ge=0)
    created_at: datetime
    updated_at: datetime


class OrderLine(BaseModel):
    id: str
    variant_id: str
    product_name: str
    variant_name: str
    sku: str
    unit_price: Decimal = Field(ge=0)
    quantity: int = Field(gt=0)
    total_price: Decimal = Field(ge=0)
    image_url: str | None


class OrderDetail(OrderSummary):
    items: list[OrderLine]


class OrderPage(BaseModel):
    items: list[OrderSummary]
    total: int
    offset: int
    limit: int
