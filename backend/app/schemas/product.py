from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    stock: int = Field(ge=0)
    category_id: int = Field(gt=0)


class ProductResponse(ProductCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
