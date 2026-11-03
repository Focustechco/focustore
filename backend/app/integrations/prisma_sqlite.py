"""Shared read-only connection to the existing Prisma source, never a new DB."""
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
import sqlite3


@contextmanager
def readonly_connection(path: Path) -> Iterator[sqlite3.Connection]:
    if not path.is_absolute():
        raise ValueError('Prisma path must be absolute')
    connection = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True, timeout=2)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute('PRAGMA query_only = ON')
        connection.execute('BEGIN')
        yield connection
    finally:
        connection.close()


def prisma_datetime(value: object):
    from datetime import datetime, timezone
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value / 1000, tz=timezone.utc)
    date = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    return date.replace(tzinfo=timezone.utc) if date.tzinfo is None else date.astimezone(timezone.utc)
