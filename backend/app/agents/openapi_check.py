"""Export deterministic OpenAPI schema and check it against committed snapshot."""
import argparse
import json
import os
from pathlib import Path

SNAPSHOT = Path(__file__).resolve().parents[2] / 'docs' / 'openapi.json'


def generated() -> str:
    from app.main import app

    return json.dumps(app.openapi(), ensure_ascii=False, sort_keys=True, indent=2) + '\n'


def changes(before, after, path='') -> list[str]:
    """Conservative structural review, not a complete compatibility proof."""
    if before == after:
        return []
    if isinstance(before, dict) and isinstance(after, dict):
        result = []
        for key in sorted(before.keys() | after.keys()):
            pointer = path + '/' + key.replace('~', '~0').replace('/', '~1')
            if key not in after:
                result.append(f'POTENTIALLY BREAKING removal: {pointer}')
            elif key not in before:
                additive = path == '/paths' or (path.startswith('/paths/') and key in {'get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'})
                label = 'ADDED operation/path' if additive else 'REVIEW addition (may affect compatibility)'
                result.append(f'{label}: {pointer}')
            else:
                result.extend(changes(before[key], after[key], pointer))
        return result
    return [f'POTENTIALLY BREAKING change: {path or "/"}']


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--write', action='store_true', help='Update committed OpenAPI snapshot')
    args = parser.parse_args(argv)
    if args.write and (os.environ.get('CI', '').lower() in {'true', '1'} or os.environ.get('GITHUB_ACTIONS', '').lower() == 'true'):
        print('FAIL: reference updates are disabled in CI')
        return 1
    try:
        actual = generated()
    except Exception as exc:
        print(f'FAIL: OpenAPI generation could not complete ({type(exc).__name__})')
        return 1
    if args.write:
        SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
        SNAPSHOT.write_text(actual, encoding='utf-8')
        print(f'Updated {SNAPSHOT}')
        return 0
    if not SNAPSHOT.exists():
        print('OpenAPI snapshot missing. Run python -m app.agents.openapi_check --write and commit it.')
        return 1
    try:
        differences = changes(json.loads(SNAPSHOT.read_text(encoding='utf-8')), json.loads(actual))
    except (OSError, ValueError):
        print('FAIL: OpenAPI reference unreadable or invalid JSON')
        return 1
    if differences:
        for difference in differences:
            print(difference)
        print('FAIL: OpenAPI contract changed. Review the change and run python -m app.agents.openapi_check --write locally.')
        return 1
    print('PASS: OpenAPI contract matches committed snapshot')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
