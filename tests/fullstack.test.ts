import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { randomUUID, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { verifiedDatabaseUrl } from '../src/lib/db/database-url';
import { HIDDEN_PRODUCT_SLUGS } from '../src/modules/catalog/catalog-policy';
import { postgresTestUrl } from './helpers/postgres-test';

let directory: string;
let sqlite: string;
let client: PrismaClient;
let stack: ChildProcess | undefined;
let frontend: string;
let backend: string;
let frontendPort: number;
let backendPort: number;
let frontendDatabaseUrl: string;
let logs = '';
let cookie = '';
let productId = '';
let variantId = '';
let categoryId = '';
let catalog: typeof import('../src/modules/catalog/catalog.service').CatalogService;
const email = 'persistence@example.test';
const password = 'synthetic-persistence-password';
const sessionSecret = randomUUID();

async function freePort(): Promise<number> {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const address = socket.address();
  assert(address && typeof address !== 'string');
  await new Promise<void>(resolve => socket.close(() => resolve()));
  return address.port;
}

async function waitReady(url: string) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (stack && stack.exitCode !== null) throw new Error('Local stack failed: ' + logs);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.status === 200) return;
    } catch { /* Process may still be starting. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Local stack readiness timed out: ' + logs);
}

async function startStack() {
  logs = '';
  stack = spawn(process.execPath, ['--import', 'tsx', 'scripts/dev-fullstack.ts'], {
    cwd: process.cwd(), windowsHide: true, detached: process.platform !== 'win32',
    env: { ...process.env, NODE_ENV: 'development', DATABASE_URL: frontendDatabaseUrl,
      LEGACY_CATALOG_SQLITE_PATH: sqlite,
      FOCUS_FRONTEND_PORT: String(frontendPort), FOCUS_BACKEND_PORT: String(backendPort),
      // Deliberately unreachable SQLAlchemy database: this test never writes PostgreSQL.
      FOCUS_BACKEND_DATABASE_URL: 'postgresql+psycopg://unused@127.0.0.1:1/fullstack_test',
      NEXTAUTH_SECRET: sessionSecret, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  stack.stdout?.on('data', value => { logs = (logs + value).slice(-12000); });
  stack.stderr?.on('data', value => { logs = (logs + value).slice(-12000); });
  await Promise.all([waitReady(frontend + '/api/auth/session'), waitReady(backend + '/health')]);
}

async function stopStack() {
  if (!stack || stack.exitCode !== null || !stack.pid) return;
  const processToStop = stack;
  const exited = once(processToStop, 'exit');
  if (process.platform === 'win32') {
    execFileSync('taskkill', ['/PID', String(processToStop.pid), '/T', '/F'], { stdio: 'ignore' });
  } else process.kill(-processToStop.pid!, 'SIGTERM');
  await exited;
  stack = undefined;
}

async function restartStack() {
  const previousPid = stack?.pid;
  await stopStack();
  await client.$disconnect();
  await startStack();
  client = new PrismaClient({ datasources: { db: { url: frontendDatabaseUrl } }, log: [] });
  assert.notEqual(stack?.pid, previousPid);
}

async function api(route: string, method = 'GET', body?: unknown) {
  return fetch(frontend + route, { method, headers: {
    ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(cookie ? { cookie } : {}),
  }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
}

async function adaptedProduct(slug = 'fullstack-product') {
  const response = await fetch(backend + '/api/v1/catalog/products/' + slug);
  assert.equal(response.status, 200);
  return response.json();
}

before(async () => {
  const root = path.join(process.cwd(), '.local-validation');
  await mkdir(root, { recursive: true });
  directory = await mkdtemp(path.join(root, 'fullstack-'));
  sqlite = path.join(directory, 'store.db');
  await writeFile(sqlite, '', { flag: 'wx' });
  frontendDatabaseUrl = postgresTestUrl('fullstack');
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--schema', 'prisma/schema.prisma', '--skip-generate'],
               { env: { ...process.env, DATABASE_URL: frontendDatabaseUrl }, stdio: 'pipe' });
  Object.assign(process.env, { DATABASE_URL: frontendDatabaseUrl, NODE_ENV: 'test' });
  client = new PrismaClient({ datasources: { db: { url: frontendDatabaseUrl } }, log: [] });
  catalog = (await import('../src/modules/catalog/catalog.service')).CatalogService;
  frontendPort = await freePort();
  do { backendPort = await freePort(); } while (backendPort === frontendPort);
  frontend = `http://127.0.0.1:${frontendPort}`;
  backend = `http://127.0.0.1:${backendPort}`;
  await startStack();
}, { timeout: 120000 });

after(async () => {
  await stopStack();
  await client?.$disconnect();
  // Keep only this synthetic fixture for inspection; never delete existing DB files.
});

test('missing or invalid configured SQLite is rejected without creating a file', async () => {
  const missing = path.join(directory, 'missing.db');
  assert.throws(() => verifiedDatabaseUrl({ DATABASE_URL: `file:${missing}` }));
  assert.equal(existsSync(missing), false);
  const invalid = path.join(directory, 'invalid.db');
  await writeFile(invalid, 'not SQLite', { flag: 'wx' });
  assert.throws(() => verifiedDatabaseUrl({ DATABASE_URL: `file:${invalid}` }));
  assert.equal(await readFile(invalid, 'utf8'), 'not SQLite');
  assert.throws(() => verifiedDatabaseUrl({}));
});

test('HTTP registration and sessions persist after logout, login and application restart', { timeout: 120000 }, async () => {
  const registration = { name: 'Persistence Test', email, password };
  const created = await api('/api/auth/register', 'POST', registration);
  assert.equal(created.status, 200);
  cookie = created.headers.get('set-cookie')!.split(';')[0];
  const stored = await client.user.findUniqueOrThrow({ where: { email } });
  assert.equal(await client.user.count(), 1);
  assert.notEqual(stored.passwordHash, password);
  assert(await bcrypt.compare(password, stored.passwordHash!));
  assert.equal(await client.session.count({ where: { userId: stored.id } }), 1);
  assert.equal((await api('/api/auth/session', 'DELETE')).status, 200);
  assert.equal(await client.session.count({ where: { userId: stored.id } }), 0);
  const login = await api('/api/auth/login', 'POST', { identifier: email, password });
  assert.equal(login.status, 200);
  cookie = login.headers.get('set-cookie')!.split(';')[0];
  await restartStack();
  assert.equal((await client.user.findUniqueOrThrow({ where: { email } })).id, stored.id);
  assert.equal(await client.session.count({ where: { userId: stored.id } }), 1);
  assert.equal((await (await api('/api/auth/session')).json()).user.id, stored.id);
  assert.equal((await api('/api/auth/login', 'POST', { identifier: email, password })).status, 200);
  assert.equal((await api('/api/auth/register', 'POST', registration)).status, 409);
});

test('admin HTTP writes persist in Prisma PostgreSQL while FastAPI keeps its legacy catalog boundary', { timeout: 60000 }, async () => {
  const empty = await fetch(backend + '/api/v1/catalog/products');
  assert.equal(empty.status, 503);
  const stored = await client.user.findUniqueOrThrow({ where: { email } });
  // Grant admin only in this newly created synthetic database.
  await client.user.update({ where: { id: stored.id }, data: { role: 'ADMIN' } });
  const categoryResponse = await api('/api/admin/categories', 'POST', { name: 'Synthetic category', slug: 'fullstack-category' });
  assert.equal(categoryResponse.status, 201);
  categoryId = (await categoryResponse.json()).category.id;
  const created = await api('/api/admin/products', 'POST', {
    name: 'Fullstack product', slug: 'fullstack-product', sku: 'FULLSTACK-1',
    description: 'Synthetic integration fixture', basePrice: 129.90, promotionalPrice: 119.90,
    categoryIds: [categoryId], images: ['/images/fullstack-synthetic.png'],
    variants: [{ name: 'Synthetic variant', sku: 'FULLSTACK-V1', price: 109.90,
      promotionalPrice: 99.90, stock: 6, imageUrl: '/images/fullstack-variant.png' }],
  });
  assert.equal(created.status, 201);
  const saved = (await created.json()).product;
  productId = saved.id; variantId = saved.variants[0].id;
  const fromService = await catalog.getProductBySlug('fullstack-product');
  assert.equal(fromService!.id, productId);
  assert.equal(fromService!.variants[0].id, variantId);
  const before = createHash('sha256').update(await readFile(sqlite)).digest('hex');
  assert.equal((await fetch(backend + '/api/v1/catalog/products')).status, 503);
  assert.equal(createHash('sha256').update(await readFile(sqlite)).digest('hex'), before);
  assert.equal(await client.product.count(), 1);
});

test('Prisma catalog updates survive restart without mutating the FastAPI legacy source', { timeout: 120000 }, async () => {
  const updated = await api(`/api/admin/products/${productId}`, 'PUT', {
    name: 'Updated product', basePrice: 149.90, promotionalPrice: 139.90,
    images: ['/images/fullstack-updated.png'],
    variants: [{ id: variantId, price: 119.90, promotionalPrice: 109.90, stock: 9 }],
  });
  assert.equal(updated.status, 200);
  const expected = await catalog.getProductBySlug('fullstack-product');
  assert.ok(expected);
  assert.equal(expected.id, productId);
  assert.equal(expected.name, 'Updated product');
  assert.equal(expected.variants[0].inventory?.quantityAvailable, 9);
  assert.equal(expected.images[0].url, '/images/fullstack-updated.png');
  await restartStack();
  assert.equal((await catalog.getProductBySlug('fullstack-product'))!.name, 'Updated product');
  assert.equal((await fetch(backend + '/api/v1/catalog/products?offset=1&limit=1')).status, 503);
  assert.equal(await client.product.count(), 1);
  const denied = await fetch(backend + '/products', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Must not write', price: '1.00', stock: 1, category_id: 1 }) });
  assert.equal(denied.status, 503);
});

test('Prisma applies its merchandising exclusion without copying records into FastAPI', async () => {
  const created = await api('/api/admin/products', 'POST', {
    name: 'Hidden synthetic product', slug: HIDDEN_PRODUCT_SLUGS[0], sku: 'HIDDEN-SYNTHETIC', basePrice: 1,
  });
  assert.equal(created.status, 201);
  assert.equal(await catalog.getProductBySlug(HIDDEN_PRODUCT_SLUGS[0]), null);
  assert.equal((await fetch(backend + '/api/v1/catalog/products/' + HIDDEN_PRODUCT_SLUGS[0])).status, 503);
  assert.equal(await client.product.count(), 2); // Two distinct fixtures, no copied or duplicated products.
});
