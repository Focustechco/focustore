import { randomUUID } from 'node:crypto';

/** Returns an isolated PostgreSQL schema for a frontend test suite. */
export function postgresTestUrl(suite: string): string {
  const raw = process.env.FOCUS_TEST_DATABASE_URL;
  if (!raw) {
    throw new Error('Configure FOCUS_TEST_DATABASE_URL apontando para um PostgreSQL descartável *_test antes dos testes Prisma.');
  }

  const parsed = new URL(raw);
  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error('FOCUS_TEST_DATABASE_URL deve usar PostgreSQL.');
  }
  if (!parsed.hostname || !parsed.pathname || parsed.pathname === '/') {
    throw new Error('FOCUS_TEST_DATABASE_URL deve informar host e banco.');
  }

  const database = decodeURIComponent(parsed.pathname.slice(1));
  if (!database.endsWith('_test')) {
    throw new Error('FOCUS_TEST_DATABASE_URL deve apontar para um banco terminado em _test.');
  }

  const safeSuite = suite.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  parsed.searchParams.set('schema', `focus_${safeSuite}_${process.pid}_${randomUUID().replace(/-/g, '')}`);
  return parsed.toString();
}
