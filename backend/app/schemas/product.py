from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ProductCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    price: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    stock: int = Field(ge=0, le=2147483647, strict=True)
    category_id: int = Field(gt=0, strict=True)


class ProductResponse(ProductCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int


class ProductUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None
    price: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)
    stock: int | None = Field(default=None, ge=0, le=2147483647, strict=True)
    category_id: int | None = Field(default=None, gt=0, strict=True)

    @model_validator(mode='after')
    def valid_patch(self):
        if not self.model_fields_set:
            raise ValueError('Informe ao menos um campo.')
        if any(getattr(self, key) is None for key in self.model_fields_set - {'description'}):
            raise ValueError('Campo obrigatório não pode ser nulo.')
        return self


class StockAdjustment(BaseModel):
    model_config = ConfigDict(extra='forbid')
    delta: int = Field(strict=True, ge=-2147483647, le=2147483647)

    @model_validator(mode='after')
    def nonzero(self):
        if self.delta == 0:
            raise ValueError('Ajuste deve ser diferente de zero.')
        return self
