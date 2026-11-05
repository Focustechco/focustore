"""Opaque, hash-only PostgreSQL session tokens."""

import hashlib
import secrets


POSTGRES_SESSION_PREFIX = "pg_"


def new_session_token() -> str:
    return POSTGRES_SESSION_PREFIX + secrets.token_urlsafe(32)


def session_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
