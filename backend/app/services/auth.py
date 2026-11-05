"""PostgreSQL-backed customer registration and session use cases."""

from datetime import datetime, timedelta, timezone
import hashlib

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import Settings
from app.models.user import AuthRateLimit, User, UserSession
from app.schemas.auth import LoginRequest, RegisterRequest
from app.security.passwords import hash_password, verify_password, needs_rehash
from app.security.tokens import new_session_token, session_token_hash, POSTGRES_SESSION_PREFIX


class DuplicateEmail(Exception):
    pass


class InvalidCredentials(Exception):
    pass


class RateLimitExceeded(Exception):
    pass


_DUMMY_PASSWORD_HASH = hash_password("focusstore-invalid-user-password")


def _is_email_conflict(exc: IntegrityError) -> bool:
    original = getattr(exc, "orig", None)
    diagnostic = getattr(original, "diag", None)
    if getattr(diagnostic, "constraint_name", None) == "uq_users_email":
        return True
    detail = str(original).lower()
    return "users.email" in detail or "uq_users_email" in detail


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _rate_key(scope: str, identity: str) -> str:
    return hashlib.sha256(f"{scope}:{identity}".encode("utf-8")).hexdigest()


def _consume_rate_limit(db: Session, settings: Settings, scope: str, identity: str) -> None:
    key_hash = _rate_key(scope, identity)
    now = _now()
    try:
        row = db.scalar(
            select(AuthRateLimit).where(AuthRateLimit.key_hash == key_hash).with_for_update()
        )
        if row is None:
            row = AuthRateLimit(key_hash=key_hash, window_started=now, attempts=1)
            db.add(row)
            allowed = True
        else:
            if (now - _as_utc(row.window_started)).total_seconds() >= settings.auth_rate_limit_window_seconds:
                row.window_started = now
                row.attempts = 1
            else:
                row.attempts += 1
            row.updated_at = now
            allowed = row.attempts <= settings.auth_rate_limit_attempts
        db.commit()
    except IntegrityError:
        db.rollback()
        # A concurrent first request can win the primary-key insert. Retry
        # against the row it created so all instances share one counter.
        row = db.scalar(
            select(AuthRateLimit).where(AuthRateLimit.key_hash == key_hash).with_for_update()
        )
        if row is None:
            raise
        row.attempts += 1
        row.updated_at = now
        allowed = row.attempts <= settings.auth_rate_limit_attempts
        db.commit()
    if not allowed:
        raise RateLimitExceeded


def _clear_rate_limit(db: Session, scope: str, identity: str) -> None:
    db.execute(delete(AuthRateLimit).where(AuthRateLimit.key_hash == _rate_key(scope, identity)))
    db.commit()


def _new_session(user: User, settings: Settings) -> tuple[UserSession, str]:
    raw_token = new_session_token()
    session = UserSession(
        user_id=user.id,
        token_hash=session_token_hash(raw_token),
        expires_at=_now() + timedelta(minutes=settings.auth_session_ttl_minutes),
    )
    return session, raw_token


def register(db: Session, data: RegisterRequest, settings: Settings, client_host: str) -> tuple[User, str]:
    _consume_rate_limit(db, settings, "register", f"{client_host}:{data.email}")
    user = User(name=data.name, email=data.email, password_hash=hash_password(data.password), role="CUSTOMER")
    try:
        db.add(user)
        db.flush()
        session, raw_token = _new_session(user, settings)
        db.add(session)
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        if not _is_email_conflict(exc):
            raise
        raise DuplicateEmail from exc
    _clear_rate_limit(db, "register", f"{client_host}:{data.email}")
    return user, raw_token


def login(db: Session, data: LoginRequest, settings: Settings, client_host: str) -> tuple[User, str]:
    _consume_rate_limit(db, settings, "login", f"{client_host}:{data.email}")
    user = db.scalar(select(User).where(User.email == data.email))
    valid = verify_password(data.password, user.password_hash if user else _DUMMY_PASSWORD_HASH)
    if user is None or not valid or user.role != "CUSTOMER":
        raise InvalidCredentials
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(data.password)
    session, raw_token = _new_session(user, settings)
    try:
        db.add(session)
        db.commit()
        db.refresh(user)
    except SQLAlchemyError:
        db.rollback()
        raise
    _clear_rate_limit(db, "login", f"{client_host}:{data.email}")
    return user, raw_token


def current_postgres_user(db: Session, raw_token: str) -> User | None:
    if not raw_token.startswith(POSTGRES_SESSION_PREFIX):
        return None
    now = _now()
    return db.scalar(
        select(User)
        .join(UserSession, UserSession.user_id == User.id)
        .where(
            UserSession.token_hash == session_token_hash(raw_token),
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now,
        )
    )


def logout(db: Session, raw_token: str | None) -> None:
    if not raw_token or not raw_token.startswith(POSTGRES_SESSION_PREFIX):
        return
    session = db.scalar(
        select(UserSession).where(UserSession.token_hash == session_token_hash(raw_token))
    )
    if session is not None and session.revoked_at is None:
        session.revoked_at = _now()
        db.commit()
