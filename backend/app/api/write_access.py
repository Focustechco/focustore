"""Until shared authentication exists, writes are opt-in for isolated local use."""
from fastapi import HTTPException

from app.config import get_settings


def require_local_write_access() -> None:
    settings = get_settings()
    if settings.app_environment not in {'development', 'test'} or not settings.allow_local_writes:
        raise HTTPException(status_code=503, detail='Escrita indisponível sem autorização configurada.')
