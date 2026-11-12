import path from 'node:path';

/** Returns an isolated SQLite database URL inside a test-owned temporary directory. */
export function sqliteTestUrl(directory: string, suite: string): string {
  const safeSuite = suite.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  return `file:${path.join(directory, `${safeSuite}.db`).replace(/\\/g, '/')}`;
}
