from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PaymentMethod(StrEnum):
    PIX = 'PIX'
    CREDIT_CARD = 'CREDIT_CARD'


class CheckoutLineInput(BaseModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True)

    variant_id: UUID = Field(alias='variantId')
    quantity: int = Field(gt=0, le=999, strict=True)


class ShippingAddressInput(BaseModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True)

    street: str = Field(min_length=1, max_length=150)
    number: str = Field(min_length=1, max_length=30)
    complement: str | None = Field(default=None, max_length=100)
    neighborhood: str = Field(min_length=1, max_length=100)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=2, max_length=2)
    postal_code: str = Field(alias='postalCode', min_length=8, max_length=10)


class ShippingOptionInput(BaseModel):
    model_config = ConfigDict(extra='forbid')

    carrier: str = Field(min_length=1, max_length=80)
    service_name: str = Field(alias='serviceName', min_length=1, max_length=80)


class CheckoutCreate(BaseModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True)

    items: list[CheckoutLineInput] = Field(min_length=1, max_length=100)
    shipping_address: ShippingAddressInput = Field(alias='shippingAddress')
    shipping_option: ShippingOptionInput = Field(alias='shippingOption')
    payment_method: PaymentMethod = Field(alias='paymentMethod')
    idempotency_key: str = Field(alias='idempotencyKey', min_length=1, max_length=200)


class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    variant_public_id: UUID
    product_name: str
    variant_name: str
    sku: str
    unit_price: Decimal
    quantity: int
    line_total: Decimal


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    provider: str
    method: str
    status: str
    amount: Decimal


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    public_id: UUID
    status: str
    currency: str
    subtotal: Decimal
    discount_amount: Decimal
    shipping_amount: Decimal
    total: Decimal
    shipping_option: str
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemResponse]
    payments: list[PaymentResponse]


class OrderPage(BaseModel):
    items: list[OrderResponse]
    total: int
    offset: int
    limit: int


class PaymentSimulationInput(BaseModel):
    model_config = ConfigDict(extra='forbid')

    status: str = Field(pattern='^(paid|failed)$')
