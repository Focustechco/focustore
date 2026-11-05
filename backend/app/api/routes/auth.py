from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.dependencies import get_db
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest
from app.security.session import require_trusted_origin, session_cookie
from app.services.auth import (
    DuplicateEmail,
    InvalidCredentials,
    RateLimitExceeded,
    login as login_user,
    logout as logout_user,
    register as register_user,
)


router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])
DbSession = Annotated[Session, Depends(get_db)]
TrustedOrigin = Annotated[None, Depends(require_trusted_origin)]


def _client_host(request: Request) -> str:
    return request.client.host if request.client is not None else "unknown"


def _public_user(user) -> AuthResponse:
    return AuthResponse(id=user.id, name=user.name, email=user.email, role=user.role)


def _set_session_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key="focus_session",
        value=token,
        max_age=settings.auth_session_ttl_minutes * 60,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        path="/",
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    data: RegisterRequest,
    request: Request,
    response: Response,
    db: DbSession,
    _origin: TrustedOrigin,
):
    try:
        user, token = register_user(db, data, get_settings(), _client_host(request))
    except RateLimitExceeded as exc:
        raise HTTPException(429, "Tente novamente mais tarde.") from exc
    except DuplicateEmail as exc:
        raise HTTPException(409, "E-mail já cadastrado.") from exc
    _set_session_cookie(response, token)
    return _public_user(user)


@router.post("/login", response_model=AuthResponse)
def login(
    data: LoginRequest,
    request: Request,
    response: Response,
    db: DbSession,
    _origin: TrustedOrigin,
):
    try:
        user, token = login_user(db, data, get_settings(), _client_host(request))
    except RateLimitExceeded as exc:
        raise HTTPException(429, "Tente novamente mais tarde.") from exc
    except InvalidCredentials as exc:
        raise HTTPException(401, "Credenciais inválidas.") from exc
    _set_session_cookie(response, token)
    return _public_user(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    db: DbSession,
    _origin: TrustedOrigin,
    focus_session: Annotated[str | None, Depends(session_cookie)],
):
    try:
        logout_user(db, focus_session)
    except SQLAlchemyError as exc:
        raise HTTPException(503, "Persistência indisponível.") from exc
    response.delete_cookie("focus_session", path="/")
