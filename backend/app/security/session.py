"""Resolve PostgreSQL customer sessions and legacy administrative sessions."""

from datetime import datetime, timezone
import sqlite3
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from pydantic import ValidationError
from fastapi.security import APIKeyCookie
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.dependencies import get_db
from app.integrations.prisma_sqlite import readonly_connection, prisma_datetime
from app.schemas.identity import CurrentUser
from app.services.auth import current_postgres_user


session_cookie = APIKeyCookie(name='focus_session', auto_error=False)


def current_user(
    focus_session: Annotated[str | None, Depends(session_cookie)],
    db: Annotated[Session, Depends(get_db)],
) -> CurrentUser:
    if not focus_session or len(focus_session) > 512:
        raise HTTPException(401, 'Autenticacao necessaria.')

    # The prefix is a hard boundary: a PostgreSQL token is never retried
    # against the legacy source, preventing authentication downgrade.
    if focus_session.startswith('pg_'):
        try:
            user = current_postgres_user(db, focus_session)
        except SQLAlchemyError as exc:
            raise HTTPException(503, 'Fonte de identidade indisponivel.') from exc
        if user is None:
            raise HTTPException(401, 'Autenticacao necessaria.')
        return CurrentUser(id=user.id, name=user.name, email=user.email, role=user.role)

    path = get_settings().legacy_catalog_sqlite_path
    if path is None:
        raise HTTPException(503, 'Fonte de identidade indisponivel.')
    try:
        with readonly_connection(path) as connection:
            row = connection.execute('''
                SELECT u.id, u.name, u.email, u.role, s.expires
                FROM sessions s JOIN users u ON u.id = s.user_id
                WHERE s.session_token = ?
            ''', (focus_session,)).fetchone()
            if row is None or prisma_datetime(row['expires']) <= datetime.now(timezone.utc):
                raise HTTPException(401, 'Autenticacao necessaria.')
            return CurrentUser(**{key: row[key] for key in ('id', 'name', 'email', 'role')})
    except (sqlite3.Error, OSError, ValueError, OverflowError, ValidationError) as exc:
        raise HTTPException(503, 'Fonte de identidade indisponivel.') from exc


User = Annotated[CurrentUser, Depends(current_user)]


def require_trusted_origin(request: Request) -> None:
    # Cookie authentication requires CSRF protection. No forwarded-host trust.
    origin = request.headers.get('origin')
    allowed = {str(request.base_url).rstrip('/')}
    if get_settings().frontend_origin:
        allowed.add(get_settings().frontend_origin)
    if origin not in allowed or request.headers.get('sec-fetch-site') == 'cross-site':
        raise HTTPException(403, 'Origem nao autorizada.')


def require_admin(request: Request, user: User) -> CurrentUser:
    if user.role not in {'ADMIN', 'MANAGER'}:
        raise HTTPException(403, 'Acesso nao autorizado.')
    require_trusted_origin(request)
    return user


Admin = Annotated[CurrentUser, Depends(require_admin)]
