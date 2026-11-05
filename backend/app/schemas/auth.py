from pydantic import BaseModel, Field, field_validator
import re

from app.schemas.identity import CurrentUser


_EMAIL_PATTERN = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}$")


def normalize_email(value: str) -> str:
    normalized = value.strip().casefold()
    if not _EMAIL_PATTERN.fullmatch(normalized):
        raise ValueError("E-mail inválido.")
    return normalized


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=12, max_length=128)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("Nome obrigatório.")
        return normalized

    @field_validator("email")
    @classmethod
    def normalize_email_field(cls, value: str) -> str:
        return normalize_email(value)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email_field(cls, value: str) -> str:
        return normalize_email(value)


class AuthResponse(CurrentUser):
    pass
