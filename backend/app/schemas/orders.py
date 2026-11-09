"""Read contract for the current user's existing Prisma order snapshots."""
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class OrderItemInput(BaseModel):
    model_config = {'extra': 'forbid', 'populate_by_name': True}
    variant_id: str = Field(alias='variantId', min_length=1, max_length=40)
    quantity: int = Field(gt=0, le=999, strict=True)


class OrderCreateInput(BaseModel):
    model_config = {'extra': 'forbid', 'populate_by_name': True}
    items: list[OrderItemInput] = Field(min_length=1, max_length=100)
    idempotency_key: str | None = Field(default=None, alias='idempotencyKey', min_length=16, max_length=128)


class OrderSummary(BaseModel):
    id: str
    order_number: str
    status: str
    subtotal: Decimal = Field(ge=0)
    discount_amount: Decimal = Field(ge=0)
    shipping_amount: Decimal = Field(ge=0)
    total: Decimal = Field(ge=0)
    currency: str = 'BRL'
    created_at: datetime
    updated_at: datetime


class OrderLine(BaseModel):
    id: str
    variant_id: str
    product_id: str | None = None
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
