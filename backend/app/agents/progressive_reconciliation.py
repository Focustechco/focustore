"""Run a bounded, read-only migration rehearsal against synthetic local sources."""

import argparse
import json
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.services.progressive_migration import dry_run


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database-url', required=True)
    parser.add_argument('--prisma-snapshot', required=True, type=Path)
    parser.add_argument('--namespace', required=True)
    parser.add_argument('--after-id', type=int, default=0)
    parser.add_argument('--limit', type=int, default=1000)
    parser.add_argument('--dry-run', action='store_true', help='Required safety acknowledgement; no writes are possible.')
    args = parser.parse_args(argv)
    if not args.dry_run:
        parser.error('This tool is read-only; pass --dry-run explicitly.')
    try:
        url = make_url(args.database_url)
        if url.get_backend_name() != 'postgresql' or url.host not in {'localhost', '127.0.0.1', '::1'}:
            raise ValueError('only loopback PostgreSQL is permitted')
        if not url.database or not url.database.endswith('_test'):
            raise ValueError('database name must end with _test')
        if not args.prisma_snapshot.is_file():
            raise ValueError('Prisma snapshot must be an existing file')
        if not 0 <= args.after_id or not 1 <= args.limit <= 1000:
            raise ValueError('invalid bounded scan')
        engine = create_engine(url, hide_parameters=True)
        with Session(engine) as db, db.begin():
            db.execute(text('SET TRANSACTION READ ONLY'))
            report = dry_run(db, args.prisma_snapshot.resolve(), args.namespace,
                             after_id=args.after_id, limit=args.limit)
        engine.dispose()
        print(json.dumps(report.document(), ensure_ascii=False, sort_keys=True, indent=2))
        return 0
    except (OSError, ValueError) as exc:
        print(f'REJECTED: {exc}')
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
