import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { databaseUrl } from '../src/lib/db/database-url';
import { canReadGuestOrder, grantGuestOrder } from '../src/lib/auth/guest-order';
import { imageDestination, limitedFormData, sanitizeImage, MAX_IMAGE_BYTES } from '../src/lib/security/upload';
import sharp from 'sharp';
import { validateProductInput, validatePromotionalPrice } from '../src/modules/catalog/product-validation';
import { sameOrigin } from '../src/lib/security/origin';
import { restoredCart } from '../src/modules/cart/cart-validation';
import { assertDemoSeed } from '../scripts/seed-safety.cjs';
import { nextTestConfig } from './helpers/next-config';

let directory: string;
let fixtureRoot: string;
let prisma: PrismaClient;
let checkout: typeof import('../src/modules/checkout/checkout.service').CheckoutService;
let payments: typeof import('../src/modules/payments/payment.service').PaymentService;
let catalog: typeof import('../src/modules/catalog/catalog.service').CatalogService;
let server: ChildProcess;
let base: string;
let output = '';
let adminCookie = '';
let customerCookie = '';
let productId: string;
let variantId: string;
let categoryId: string;

async function api(route: string, method = 'GET', body?: unknown, cookie?: string) {
  return fetch(base + route, { method, redirect: 'manual', headers: {
    ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(cookie ? { cookie } : {}),
  }, body: body === undefined ? undefined : JSON.stringify(body) });
}

before(async () => {
  fixtureRoot = path.join(process.cwd(), '.local-validation');
  await mkdir(fixtureRoot, { recursive: true });
  directory = await mkdtemp(path.join(fixtureRoot, 'focusstore-audit-test-'));
  await writeFile(path.join(directory, 'store.db'), '');
  const url = `file:${path.join(directory, 'store.db').replace(/\\/g, '/')}`;
  Object.assign(process.env, { DATABASE_URL: url, NODE_ENV: 'test', NEXTAUTH_SECRET: randomUUID() });
  process.env.SOCIAL_LOGIN_ORIGIN = ''; // Never call real OAuth providers in this HTTP suite.
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--schema', 'prisma/schema.prisma', '--skip-generate'],
               { env: process.env, stdio: 'pipe' });
  prisma = (await import('../src/lib/db/prisma')).prisma;
  checkout = (await import('../src/modules/checkout/checkout.service')).CheckoutService;
  payments = (await import('../src/modules/payments/payment.service')).PaymentService;
  catalog = (await import('../src/modules/catalog/catalog.service')).CatalogService;
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const address = listener.address();
  assert(address && typeof address !== 'string');
  const port = address.port;
  await new Promise<void>(resolve => listener.close(() => resolve()));
  base = `http://127.0.0.1:${port}`;
  const production = process.env.FOCUS_TEST_PRODUCTION === '1';
  const dist = production ? process.env.FOCUS_TEST_DIST_DIR : path.relative(process.cwd(), path.join(directory, 'next')).replace(/\\/g, '/');
  const tsconfig = production ? process.env.FOCUS_TEST_TSCONFIG : await nextTestConfig(directory, dist!);
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', production ? 'start' : 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, NODE_ENV: production ? 'production' : 'development', NEXT_TELEMETRY_DISABLED: '1',
      FOCUS_TEST_DIST_DIR: dist, FOCUS_TEST_TSCONFIG: tsconfig },
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout?.on('data', data => { output = (output + data).slice(-8000); });
  server.stderr?.on('data', data => { output = (output + data).slice(-8000); });
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try { if ((await fetch(base + '/api/auth/session')).status === 200) break; }
    catch { if (server.exitCode !== null) throw new Error('Test server failed: ' + output); }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  assert(Date.now() < deadline, 'Test server startup timed out');
}, { timeout: 120000 });

after(async () => {
  if (server && server.exitCode === null) {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    } else { server.kill('SIGTERM'); }
  }
  await prisma?.$disconnect();
  // Preserve the synthetic SQLite for inspection; never clean existing .db files.
});

test('database configuration preserves explicit SQLite and rejects ephemeral/unsupported production sources', () => {
  assert.equal(databaseUrl({ DATABASE_URL: 'file:./custom.db' }, '/app'), 'file:' + path.resolve('/app/prisma/custom.db').replace(/\\/g, '/'));
  assert.throws(() => databaseUrl({ NODE_ENV: 'production' }));
  assert.throws(() => databaseUrl({ DATABASE_URL: 'postgresql://placeholder' }));
  assert.throws(() => databaseUrl({ VERCEL: '1', DATABASE_URL: 'file:./dev.db' }), /SQLite não é persistente/);
  if (process.platform !== 'win32') assert.throws(() => databaseUrl({ NODE_ENV: 'production', DATABASE_URL: 'file:/tmp/store.db' }));
});

test('Prisma defers database configuration until a database operation', () => {
  const script = `
    delete process.env.DATABASE_URL;
    const { prisma } = await import('./src/lib/db/prisma.ts');
    if (!prisma) throw new Error('Prisma client was not exported');
    try {
      void prisma.session;
      throw new Error('Expected missing DATABASE_URL to fail on first database access');
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('Configure DATABASE_URL')) throw error;
    }
  `;
  execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
    env: { ...process.env, NODE_ENV: 'production', VERCEL: '1' },
    stdio: 'pipe',
  });
});

test('guest access is signed, expires and is bound to one order', () => {
  const token = grantGuestOrder('one', 1000);
  assert(canReadGuestOrder(token, 'one', 1000));
  assert(!canReadGuestOrder(token, 'two', 1000));
  assert(!canReadGuestOrder('one', 'one', 1000));
  assert(!canReadGuestOrder(token + 'x', 'one', 1000));
  assert(!canReadGuestOrder(token, 'one', 7201000));
});

test('upload confines paths, rejects SVG/spoofed MIME, limits streamed bodies', async () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert(imageDestination('images/products', png, 'image/png', directory).url.endsWith('.png'));
  for (const folder of ['../outside', '/tmp', 'images/../../outside', 'images\\products']) {
    assert.throws(() => imageDestination(folder, png, 'image/png', directory));
  }
  assert.throws(() => imageDestination('uploads', Buffer.from('<svg onload="alert(1)"/>'), 'image/svg+xml', directory));
  assert.throws(() => imageDestination('uploads', Buffer.from('<script/>'), 'image/png', directory));
  assert.throws(() => imageDestination('uploads', png, 'image/jpeg', directory));
  await assert.rejects(sanitizeImage(png));
  const validPng = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'white' } }).png().toBuffer();
  assert((await sanitizeImage(validPng)).length > 0);
  assert.throws(() => imageDestination('uploads', Buffer.alloc(MAX_IMAGE_BYTES + 1), 'image/png', directory));
  await assert.rejects(limitedFormData(new Request('http://localhost', { method: 'POST', body: Buffer.alloc(MAX_IMAGE_BYTES + 65537) })));
  const form = new FormData(); form.set('file', new File([png], 'x.png', { type: 'image/png' }));
  assert((await limitedFormData(new Request('http://localhost', { method: 'POST', body: form }))).get('file') instanceof File);
  assert(!sameOrigin(new Request('http://localhost', { headers: { origin: 'https://evil.example' } })));
});

test('product validation rejects negative stock, prices and invalid promotions', () => {
  assert.throws(() => validateProductInput({ name: 'X', sku: 'X', basePrice: -1 }));
  assert.throws(() => validateProductInput({ name: 'X', sku: 'X', basePrice: 1, variants: [{ stock: -1 }] }));
  assert.throws(() => validatePromotionalPrice(10, 11));
  const generated = validateProductInput({ name: 'X', slug: '', sku: 'X', basePrice: 1, variants: [{ sku: '', name: '' }] });
  assert.equal(generated.slug, undefined);
  assert.equal(generated.variants![0].sku, undefined);
});

test('malformed saved cart is ignored and destructive demo scripts fail closed', () => {
  assert.deepEqual(restoredCart({}), []);
  assert.deepEqual(restoredCart([null, { quantity: -1 }, { quantity: Number.NaN }]), []);
  assert.throws(() => assertDemoSeed());
});

test('registration, duplicate email, hash, login, expiration and logout persist correctly', async () => {
  const registration = { name: 'Synthetic Customer', email: 'customer@example.test', password: 'synthetic-password' };
  let response = await api('/api/auth/register', 'POST', registration);
  assert.equal(response.status, 200);
  customerCookie = response.headers.get('set-cookie')!.split(';')[0];
  assert.match(response.headers.get('set-cookie')!, /HttpOnly/i);
  assert.match(response.headers.get('set-cookie')!, /SameSite=lax/i);
  if (process.env.FOCUS_TEST_PRODUCTION === '1') assert.match(response.headers.get('set-cookie')!, /Secure/i);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: registration.email } });
  assert.notEqual(user.passwordHash, registration.password);
  assert(await bcrypt.compare(registration.password, user.passwordHash!));
  assert.equal((await api('/api/auth/register', 'POST', registration)).status, 409);
  assert.equal((await api('/api/auth/register', 'POST', { ...registration, cpf: '11111111111' })).status, 400);
  assert.equal((await api('/api/auth/register', 'POST', { ...registration, cpf: 'invalid' })).status, 400);
  assert.equal((await api('/api/auth/register', 'POST', { ...registration, password: 'é'.repeat(40) })).status, 400);
  assert.equal((await api('/api/auth/login', 'POST', { identifier: registration.email, password: 'incorrect' })).status, 401);
  response = await api('/api/auth/login', 'POST', { identifier: registration.email.toUpperCase(), password: registration.password });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await (await api('/api/auth/session', 'GET', undefined, cookie)).json()).user.id, user.id);
  assert.equal((await api('/api/auth/session', 'DELETE', undefined, cookie)).status, 200);
  assert.equal((await (await api('/api/auth/session', 'GET', undefined, cookie)).json()).user, null);
  await prisma.session.updateMany({ where: { sessionToken: customerCookie.split('=')[1] }, data: { expires: new Date(0) } });
  assert.equal((await (await api('/api/auth/session', 'GET', undefined, customerCookie)).json()).user, null);
  response = await api('/api/auth/login', 'POST', { identifier: registration.email, password: registration.password });
  customerCookie = response.headers.get('set-cookie')!.split(';')[0];
});

test('social sessions work with existing session/logout APIs and password login still works', async () => {
  const { persistIdentity } = await import('../src/lib/auth/social/persistence');
  const identity = await persistIdentity(prisma, 'google', { sub: 'synthetic-social-http',
    email: 'social-http@example.test', emailVerified: true }, {
    provider: 'google', state: randomUUID(), nonce: randomUUID(), verifier: randomUUID(), proof: randomUUID(), returnTo: '/',
  });
  const socialCookie = `focus_session=${identity.sessionToken}`;
  const session = await api('/api/auth/session', 'GET', undefined, socialCookie);
  assert.equal((await session.json()).user.id, identity.user.id);
  assert.equal((await api('/api/auth/session', 'DELETE', undefined, socialCookie)).status, 200);
  assert.equal(await prisma.session.count({ where: { sessionToken: identity.sessionToken } }), 0);
  assert.equal((await (await api('/api/auth/session', 'GET', undefined, socialCookie)).json()).user, null);
  assert.equal((await api('/api/auth/login', 'POST', { identifier: 'customer@example.test', password: 'synthetic-password' })).status, 200);
  assert.equal((await api('/api/auth/social/google/start', 'POST', {})).status, 503);
});

test('admin endpoints and server pages deny unauthenticated and ordinary users', async () => {
  for (const endpoint of ['/api/admin/products', '/api/admin/customers', '/api/admin/inventory', '/api/admin/banners/synthetic-id']) {
    assert.equal((await api(endpoint)).status, 401);
    assert.equal((await api(endpoint, 'GET', undefined, customerCookie)).status, 403);
  }
  const page = await api('/admin/pedidos');
  assert.equal(page.status, 307);
  assert.match(page.headers.get('location')!, /login/);
  await prisma.user.create({ data: { name: 'Synthetic Admin', email: 'admin@example.test', role: 'ADMIN', passwordHash: await bcrypt.hash('synthetic-admin-password', 4) } });
  const login = await api('/api/auth/login', 'POST', { identifier: 'admin@example.test', password: 'synthetic-admin-password' });
  assert.equal(login.status, 200);
  adminCookie = login.headers.get('set-cookie')!.split(';')[0];
});

test('admin banner detail route preserves authorization and CRUD behavior', async () => {
  const banner = await prisma.banner.create({
    data: { title: 'Synthetic banner', imageUrl: '/images/synthetic.png' },
  });
  const endpoint = `/api/admin/banners/${banner.id}`;

  assert.equal((await api(endpoint)).status, 401);
  assert.equal((await api(endpoint, 'GET', undefined, customerCookie)).status, 403);
  const read = await api(endpoint, 'GET', undefined, adminCookie);
  assert.equal(read.status, 200);
  assert.equal((await read.json()).banner.title, 'Synthetic banner');

  const updated = await api(endpoint, 'PUT', { title: 'Updated banner' }, adminCookie);
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).banner.title, 'Updated banner');

  assert.equal((await api(endpoint, 'DELETE', undefined, adminCookie)).status, 200);
  assert.equal(await prisma.banner.findUnique({ where: { id: banner.id } }), null);
});

test('product transaction rolls back on duplicate variant SKU; default stock is zero', async () => {
  const category = await prisma.category.create({ data: { name: 'Test', slug: 'test' } });
  categoryId = category.id;
  const input = { name: 'Rollback', slug: 'rollback', sku: 'rollback', basePrice: 10, categoryIds: [category.id], variants: [{ sku: 'duplicate' }, { sku: 'duplicate' }] };
  const response = await api('/api/admin/products', 'POST', input, adminCookie);
  assert.equal(response.status, 409);
  assert.equal(await prisma.product.count({ where: { slug: 'rollback' } }), 0);
  const created = await api('/api/admin/products', 'POST', { name: 'Default', sku: 'default', basePrice: 10 }, adminCookie);
  assert.equal(created.status, 201);
  assert.equal((await created.json()).product.variants[0].inventory.quantityAvailable, 0);
  const good = await api('/api/admin/products', 'POST', { name: 'Product', slug: 'product', sku: 'product', basePrice: 99.90, categoryIds: [category.id], images: ['/images/synthetic.png'], variants: [{ name: 'Variant', sku: 'product-v', stock: 10, price: 99.90 }] }, adminCookie);
  assert.equal(good.status, 201);
  const data = (await good.json()).product;
  productId = data.id; variantId = data.variants[0].id;
});

test('edit blocks foreign variants and rolls back unrelated changes on relation failures', async () => {
  const other = await prisma.product.findUniqueOrThrow({ where: { sku: 'default' }, include: { variants: true } });
  assert.equal((await api(`/api/admin/products/${productId}`, 'PUT', { name: 'Wrong', variants: [{ id: other.variants[0].id, stock: 50 }] }, adminCookie)).status, 400);
  assert.equal((await api(`/api/admin/products/${productId}`, 'PUT', { name: 'Wrong', categoryIds: ['nonexistent'] }, adminCookie)).status, 500);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).name, 'Product');
  assert.equal((await api(`/api/admin/inventory/${variantId}`, 'PUT', { quantityAvailable: -1 }, adminCookie)).status, 400);
  await prisma.productVariant.update({ where: { id: variantId }, data: { price: 99.90, imageUrl: '/images/retained.png', promotionalPrice: 89.90 } });
  assert.equal((await api(`/api/admin/products/${productId}`, 'PUT', { variants: [{ id: variantId, stock: 10 }] }, adminCookie)).status, 200);
  const retained = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
  assert.equal(retained.price, 99.90);
  assert.equal(retained.imageUrl, '/images/retained.png');
  assert.equal(retained.promotionalPrice, 89.90);
  await prisma.productVariant.update({ where: { id: variantId }, data: { promotionalPrice: null } });
});

function checkoutInput() {
  return { customer: { name: 'Guest', email: 'guest@example.test', phone: '11999999999', cpf: '12345678909' },
    shippingAddress: { street: 'Test', number: '1', neighborhood: 'Test', city: 'Test', state: 'SP', postalCode: '01310100' },
    shippingOption: { carrier: 'Focus Express', serviceName: 'Standard SP', price: 0, estimatedDays: 0 },
    items: [{ variantId, quantity: 1 }], paymentMethod: 'PIX' as const, idempotencyKey: randomUUID() };
}

test('checkout derives identity from session; demonstration is unavailable in production', async () => {
  if (process.env.FOCUS_TEST_PRODUCTION === '1') {
    assert.equal((await api('/api/checkout', 'POST', checkoutInput(), customerCookie)).status, 503);
    assert.equal((await api('/api/payments/webhook', 'POST', {})).status, 503);
    return;
  }
  const response = await api('/api/checkout', 'POST', { ...checkoutInput(), userId: 'untrusted-browser-user' }, customerCookie);
  assert.equal(response.status, 201);
  const data = await response.json();
  const customer = await prisma.user.findUniqueOrThrow({ where: { email: 'customer@example.test' } });
  assert.equal(data.order.userId, customer.id);
  assert.equal((await api('/api/payments/webhook', 'POST', { orderId: data.order.id, status: 'PAID' })).status, 401);
  await payments.handlePaymentWebhook({ eventId: randomUUID(), eventType: 'cancel', paymentId: data.payment.id, status: 'CANCELLED', provider: 'demo' });
});

test('checkout uses server prices/freight, reserves once and payment transitions are idempotent', async () => {
  const input = checkoutInput();
  const result = await checkout.processCheckout(input);
  assert.equal(result.order.subtotal, 99.90);
  assert.equal(result.order.shippingAmount, 12.90);
  assert.equal(result.order.total, 112.80);
  assert.equal((await checkout.processCheckout(input)).isDuplicate, true);
  await assert.rejects(checkout.processCheckout({ ...input, userId: 'another-user' }));
  let inventory = await prisma.inventory.findUniqueOrThrow({ where: { variantId } });
  assert.equal(inventory.quantityAvailable, 9); assert.equal(inventory.quantityReserved, 1);
  const event = { eventId: randomUUID(), eventType: 'payment.success', paymentId: result.payment!.id, status: 'PAID' as const, provider: 'demo' };
  await payments.handlePaymentWebhook(event);
  assert.equal((await payments.handlePaymentWebhook(event)).status, 'already_processed');
  await payments.handlePaymentWebhook({ ...event, eventId: randomUUID() });
  await assert.rejects(payments.handlePaymentWebhook({ ...event, eventId: randomUUID(), status: 'CANCELLED' }));
  inventory = await prisma.inventory.findUniqueOrThrow({ where: { variantId } });
  assert.equal(inventory.quantityAvailable, 9); assert.equal(inventory.quantityReserved, 0);
  const view = await api(`/checkout/confirmacao/${result.order.id}`);
  assert.equal(view.status, 404);
  const archive = await api(`/api/admin/products/${productId}`, 'DELETE', undefined, adminCookie);
  assert.equal(archive.status, 200);
  assert.equal(await prisma.orderItem.count({ where: { orderId: result.order.id } }), 1);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).status, 'ARCHIVED');
  await assert.rejects(checkout.processCheckout(checkoutInput()));
  assert.equal(await catalog.getProductBySlug('product'), null);
});

test('cancel releases once and invalid coupon/insufficient stock do not create orders', async () => {
  await prisma.product.update({ where: { id: productId }, data: { status: 'ACTIVE' } });
  const start = await prisma.order.count();
  await assert.rejects(checkout.processCheckout({ ...checkoutInput(), items: [{ variantId, quantity: 1000 }] }));
  await assert.rejects(checkout.processCheckout({ ...checkoutInput(), couponCode: 'MISSING' }));
  await assert.rejects(checkout.processCheckout({ ...checkoutInput(), items: [{ variantId, quantity: 1 }, { variantId, quantity: 1 }] }));
  assert.equal(await prisma.order.count(), start);
  const result = await checkout.processCheckout(checkoutInput());
  const event = { eventId: randomUUID(), eventType: 'cancelled', orderId: result.order.id, status: 'CANCELLED' as const, provider: 'demo' };
  await payments.handlePaymentWebhook(event);
  await payments.handlePaymentWebhook({ ...event, eventId: randomUUID() });
  const inventory = await prisma.inventory.findUniqueOrThrow({ where: { variantId } });
  assert.equal(inventory.quantityReserved, 0);
  assert.equal(inventory.quantityAvailable, 9);
});

test('concurrent checkout cannot reserve more than available', async () => {
  const product = await prisma.product.create({ data: {
    name: 'Last unit', slug: 'last-unit', sku: 'last-unit', description: 'Synthetic', basePrice: 1,
    variants: { create: { name: 'Last', sku: 'last-unit-v', price: 1, inventory: { create: { quantityAvailable: 1 } } } },
  }, include: { variants: true } });
  const id = product.variants[0].id;
  const results = await Promise.allSettled([1, 2].map(() => checkout.processCheckout({ ...checkoutInput(), items: [{ variantId: id, quantity: 1 }] })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const inventory = await prisma.inventory.findUniqueOrThrow({ where: { variantId: id } });
  assert.equal(inventory.quantityAvailable, 0);
  assert.equal(inventory.quantityReserved, 1);
});

test('public catalog hides inactive products, categories, collections and variants', async () => {
  const archived = await prisma.product.findUniqueOrThrow({ where: { sku: 'default' } });
  await prisma.product.update({ where: { id: archived.id }, data: { status: 'ARCHIVED' } });
  await prisma.productVariant.update({ where: { id: variantId }, data: { isActive: false } });
  await prisma.collection.create({ data: { name: 'Collection', slug: 'collection', products: { create: [
    { productId }, { productId: archived.id },
  ] } } });
  const collection = await catalog.getCollectionBySlug('collection');
  assert.equal(collection!.products.length, 1);
  assert.equal(collection!.products[0].product.variants.length, 0);
  assert.equal(await catalog.getProductBySlug(archived.slug), null);
  await prisma.collection.update({ where: { slug: 'collection' }, data: { isActive: false } });
  assert.equal(await catalog.getCollectionBySlug('collection'), null);
  await prisma.category.update({ where: { id: categoryId }, data: { isActive: false } });
  assert.equal(await catalog.getCategoryBySlug('test'), null);
});

test('coupon validity includes start date, zero usage limit and invalid discount configuration', async () => {
  const { CouponService } = await import('../src/modules/promotions/coupon.service');
  const coupon = await prisma.coupon.create({ data: { code: 'AUDIT', discountType: 'PERCENTAGE', discountValue: 10,
    startsAt: new Date(Date.now() + 86400000) } });
  assert.equal((await CouponService.validateCoupon('AUDIT', 100, 10)).valid, false);
  await prisma.coupon.update({ where: { id: coupon.id }, data: { startsAt: null, usageLimit: 0 } });
  assert.equal((await CouponService.validateCoupon('AUDIT', 100, 10)).valid, false);
  await prisma.coupon.update({ where: { id: coupon.id }, data: { usageLimit: null, maxDiscount: -1 } });
  assert.equal((await CouponService.validateCoupon('AUDIT', 100, 10)).valid, false);
});

test('catalog outages are not silently treated as empty results', async () => {
  await prisma.$executeRawUnsafe('ALTER TABLE products RENAME TO unavailable_products');
  try { await assert.rejects(catalog.getAllProducts()); }
  finally { await prisma.$executeRawUnsafe('ALTER TABLE unavailable_products RENAME TO products'); }
});
