from typing import Literal
from pydantic import BaseModel


class CurrentUser(BaseModel):
    id: str
    name: str | None
    email: str
    role: Literal['CUSTOMER', 'MANAGER', 'ADMIN']
