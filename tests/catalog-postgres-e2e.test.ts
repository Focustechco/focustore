import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { sqliteTestUrl } from './helpers/test-database';

const databaseUrl = process.env.FOCUS_E2E_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
const runId = randomUUID().replaceAll('-', '');
let ownedDatabaseUrl = '';
let databaseCreated = false;
const python = process.env.FOCUS_PYTHON_EXECUTABLE ?? (process.platform === 'win32' ? 'python' : 'python3');
const root = process.cwd();
let temporaryDirectory = '';
let frontendDatabaseUrl = '';
let frontend = '';
let backend = '';
let fastApi: ChildProcess | undefined;
let next: ChildProcess | undefined;
let logs = '';

function assertDisposableDatabase(url: string) {
  const parsed = new URL(url.replace(/^postgresql\+psycopg:/, 'postgresql:'));
  assert.equal(parsed.protocol, 'postgresql:');
  assert.ok(parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost', 'E2E database must be loopback-only');
  assert.ok(parsed.pathname.endsWith('_test'), 'E2E database name must end in _test');
  assert.ok(parsed.username, 'E2E database user is required');
  assert.ok(parsed.port, 'E2E database port is required');
}

async function freePort() {
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const address = listener.address();
  assert(address && typeof address !== 'string');
  await new Promise<void>(resolve => listener.close(() => resolve()));
  return address.port;
}

function runPython(args: string[]) {
  return execFileSync(python, args, {
    cwd: path.join(root, 'backend'),
    env: { ...process.env, DATABASE_URL: ownedDatabaseUrl || databaseUrl,
      FOCUS_E2E_DATABASE_URL: databaseUrl, FOCUS_E2E_RUN_ID: runId,
      PYTHONPATH: path.join(root, 'backend') },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60000,
  });
}

function start(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  const child = spawn(command, args, { cwd, env, detached: process.platform !== 'win32', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout?.on('data', value => { logs = (logs + value).slice(-16000); });
  child.stderr?.on('data', value => { logs = (logs + value).slice(-16000); });
  child.once('error', error => { logs += `\n${error.message}`; });
  return child;
}

async function waitReady(url: string) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (fastApi?.exitCode !== null && fastApi?.exitCode !== undefined) throw new Error(`FastAPI exited: ${logs}`);
    if (next?.exitCode !== null && next?.exitCode !== undefined) throw new Error(`Next.js exited: ${logs}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.status === 200) return;
    } catch { /* Service is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}: ${logs}`);
}

async function stop(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null || child.signalCode !== null || !child.pid) return;
  if (process.platform === 'win32') {
    execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', timeout: 10000 });
    await once(child, 'exit', { signal: AbortSignal.timeout(5000) });
    return;
  }
  process.kill(-child.pid, 'SIGTERM');
  try {
    await once(child, 'exit', { signal: AbortSignal.timeout(10000) });
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'AbortError') throw error;
    process.kill(-child.pid, 'SIGKILL');
    await once(child, 'exit', { signal: AbortSignal.timeout(5000) });
  }
}

before(async () => {
  assert.ok(databaseUrl, 'Set FOCUS_E2E_DATABASE_URL to a disposable PostgreSQL *_test database');
  assertDisposableDatabase(databaseUrl);
  console.info(runPython([path.join(root, 'scripts', 'catalog_e2e_database.py'), 'create']).trim());
  databaseCreated = true;
  const ownedUrl = new URL(databaseUrl);
  ownedUrl.pathname = `/focusstore_e2e_${runId}_test`;
  ownedDatabaseUrl = ownedUrl.toString();
  temporaryDirectory = await mkdtemp(path.join(process.env.RUNNER_TEMP ?? process.env.TEMP ?? root, 'focusstore-catalog-e2e-'));
  frontendDatabaseUrl = sqliteTestUrl(temporaryDirectory, 'frontend');
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--schema', 'prisma/schema.prisma', '--skip-generate'], {
    cwd: root, env: { ...process.env, DATABASE_URL: frontendDatabaseUrl }, stdio: 'pipe', timeout: 60000,
  });
  runPython(['-m', 'alembic', 'upgrade', 'head']);
  runPython(['-m', 'alembic', 'check']);
  runPython([path.join(root, 'scripts', 'seed_catalog_e2e.py')]);

  const backendPort = await freePort();
  const frontendPort = await freePort();
  backend = `http://127.0.0.1:${backendPort}`;
  frontend = `http://127.0.0.1:${frontendPort}`;
  fastApi = startBackend();
  next = start(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(frontendPort)], root, {
    ...process.env, NODE_ENV: 'development', DATABASE_URL: frontendDatabaseUrl,
    CATALOG_READ_SOURCE: 'fastapi', FOCUS_API_BASE_URL: backend,
    NEXTAUTH_SECRET: randomUUID(), NEXT_TELEMETRY_DISABLED: '1',
  });
  await waitReady(`${backend}/health`);
  await waitReady(`${frontend}/api/auth/session`);
}, { timeout: 180000 });

function startBackend() {
  const backendEnv = {
    ...process.env, DATABASE_URL: ownedDatabaseUrl, CATALOG_SOURCE: 'postgresql',
    FASTAPI_CHECKOUT_ENABLED: 'false', CHECKOUT_WRITE_AUTHORITY: 'prisma',
    MIGRATION_MODE: 'observe', FASTAPI_PAYMENT_SIMULATOR_ENABLED: 'false',
    FOCUS_DEBUG: 'false',
  };
  return start(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', new URL(backend).port], path.join(root, 'backend'), backendEnv);
}

after(async () => {
  const results = await Promise.allSettled([stop(next), stop(fastApi)]);
  const errors = results.filter(result => result.status === 'rejected').map(result => result.reason);
  try {
    if (databaseCreated) console.info(runPython([path.join(root, 'scripts', 'catalog_e2e_database.py'), 'drop']).trim());
  } catch (error) { errors.push(error); }
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  if (errors.length) throw new AggregateError(errors, 'E2E service cleanup failed');
});

async function page(pathname: string) {
  const response = await fetch(frontend + pathname, { signal: AbortSignal.timeout(60000) });
  assert.equal(response.status, 200, `${pathname} returned ${response.status}`);
  return renderedText(await response.text());
}

function renderedText(html: string) {
  // RSC payloads and metadata alone do not prove that product content rendered.
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ');
}

test('renders deterministic PostgreSQL catalog data through FastAPI and Next.js', async () => {
  const [home, search, category, detail] = await Promise.all([
    page('/'),
    page('/busca?q=Homolog'),
    page('/categoria/homolog-catalog'),
    page('/produto/homolog-shirt'),
  ]);
  for (const html of [home, search, category]) {
    assert.match(html, /Homolog Bottle/);
    assert.match(html, /Homolog Shirt/);
    assert.doesNotMatch(html, /Homolog Inactive/);
  }
  assert.match(home, /Homolog Bottle\s+R\$\s*0,00/);
  assert.match(home, /Homolog Shirt\s+R\$\s*99,90/);
  assert.match(detail, /Homolog Shirt/);
  assert.match(detail, /99,90|99\.90/);
  assert.match(detail, /esgotado|Esgotado|sem estoque/i);
  assert.doesNotMatch(detail, /Homolog Inactive/);
});

test('renders zero promotional price and available stock in the product body', async () => {
  const detail = await page('/produto/homolog-bottle');
  assert.match(detail, /Homolog Bottle/);
  assert.match(detail, /R\$\s*0,00/);
  assert.match(detail, /5\s+unidades em estoque/);
});

test('FastAPI exposes the same synthetic records and supports catalog filters', async () => {
  const response = await fetch(`${backend}/api/v1/catalog/products?search=Homolog&category_slug=homolog-catalog&sort=price_asc`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.total, 2);
  assert.deepEqual(data.items.map((item: { slug: string }) => item.slug), ['homolog-bottle', 'homolog-shirt']);
  assert.equal(data.items[0].base_price, '89.90');
  assert.equal(data.items[0].promotional_price, '0.00');
  assert.equal(data.items[0].variants[0].quantity_available, 5);
  assert.equal(data.items[1].available, false);
  assert.equal((await fetch(`${backend}/api/v1/catalog/products/homolog-inactive`)).status, 404);
  assert.equal((await fetch(`${backend}/api/v1/catalog/products/missing-product`)).status, 404);
  assert.equal((await fetch(`${backend}/api/v1/catalog/categories/homolog-catalog`)).status, 200);
});

test('search and category filters exclude unrelated records and preserve empty results', async () => {
  const search = await page('/busca?q=Bottle');
  assert.match(search, /Homolog Bottle/);
  assert.doesNotMatch(search, /Homolog Shirt/);
  const empty = await page('/busca?q=NoSuchHomologProduct');
  assert.match(empty, /Nenhum resultado para sua busca/);
  assert.doesNotMatch(empty, /Homolog Bottle|Homolog Shirt|temporariamente indisponível/);
  for (const query of ['category_slug=no-such-category', 'search=NoSuchHomologProduct']) {
    const response = await fetch(`${backend}/api/v1/catalog/products?${query}`, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.total, 0);
    assert.deepEqual(data.items, []);
  }
});

test('committed PostgreSQL inventory changes reach FastAPI and rendered Next.js content', async () => {
  function setStock(quantity: number) {
    runPython(['-c', `import os; from sqlalchemy import create_engine, text
engine = create_engine(os.environ['DATABASE_URL'], hide_parameters=True)
try:
    with engine.begin() as connection:
        result = connection.execute(text("UPDATE inventory SET quantity_available = :quantity WHERE variant_id = (SELECT id FROM product_variants WHERE sku = 'HOMOLOG-BOTTLE-V1')"), {'quantity': ${quantity}})
        assert result.rowcount == 1
finally:
    engine.dispose()
`]);
  }
  try {
    setStock(3);
    const response = await fetch(`${backend}/api/v1/catalog/products/homolog-bottle`, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).variants[0].quantity_available, 3);
    assert.match(await page('/produto/homolog-bottle'), /3\s+unidades em estoque/);
  } finally { setStock(5); }
});

test('does not silently fall back to Prisma when FastAPI becomes unavailable', async () => {
  await stop(fastApi);
  fastApi = undefined;
  const response = await fetch(frontend + '/busca?q=Homolog', { signal: AbortSignal.timeout(60000) });
  assert.ok([200, 503].includes(response.status));
  const html = renderedText(await response.text());
  assert.doesNotMatch(html, /Homolog Bottle/);
  assert.match(html, /Catálogo temporariamente indisponível/);
});

test('recovers the real catalog after restarting FastAPI against the same PostgreSQL database', async () => {
  fastApi = startBackend();
  await waitReady(`${backend}/health`);
  const html = await page('/busca?q=Homolog');
  assert.match(html, /Homolog Bottle/);
  assert.match(html, /Homolog Shirt/);
  assert.doesNotMatch(html, /Catálogo temporariamente indisponível/);
});
