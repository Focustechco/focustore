"""Read the real focus_session cookie and enforce role + origin for writes."""
from datetime import datetime, timezone
import sqlite3
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from pydantic import ValidationError
from fastapi.security import APIKeyCookie

from app.config import get_settings
from app.integrations.prisma_sqlite import readonly_connection, prisma_datetime
from app.schemas.identity import CurrentUser


session_cookie = APIKeyCookie(name='focus_session', auto_error=False)


def current_user(focus_session: Annotated[str | None, Depends(session_cookie)]) -> CurrentUser:
    if not focus_session or len(focus_session) > 512:
        raise HTTPException(401, 'Autenticação necessária.')
    path = get_settings().legacy_catalog_sqlite_path
    if path is None:
        raise HTTPException(503, 'Fonte de identidade indisponível.')
    try:
        with readonly_connection(path) as connection:
            row = connection.execute('''
                SELECT u.id, u.name, u.email, u.role, s.expires
                FROM sessions s JOIN users u ON u.id = s.user_id
                WHERE s.session_token = ?
            ''', (focus_session,)).fetchone()
            if row is None or prisma_datetime(row['expires']) <= datetime.now(timezone.utc):
                raise HTTPException(401, 'Autenticação necessária.')
            return CurrentUser(**{key: row[key] for key in ('id', 'name', 'email', 'role')})
    except (sqlite3.Error, OSError, ValueError, OverflowError, ValidationError) as exc:
        raise HTTPException(503, 'Fonte de identidade indisponível.') from exc


User = Annotated[CurrentUser, Depends(current_user)]


def require_admin(request: Request, user: User) -> CurrentUser:
    if user.role not in {'ADMIN', 'MANAGER'}:
        raise HTTPException(403, 'Acesso não autorizado.')
    # Cookie authentication requires CSRF protection. No forwarded-host trust.
    origin = request.headers.get('origin')
    allowed = {str(request.base_url).rstrip('/')}
    if get_settings().frontend_origin:
        allowed.add(get_settings().frontend_origin)
    if origin not in allowed or request.headers.get('sec-fetch-site') == 'cross-site':
        raise HTTPException(403, 'Origem não autorizada.')
    return user


Admin = Annotated[CurrentUser, Depends(require_admin)]
