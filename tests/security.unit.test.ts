import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grantGuestOrder, canReadGuestOrder } from '../src/lib/auth/guest-order';
import { checkOrigin, sameOrigin } from '../src/lib/security/origin';
import { copySetCookie, isPostgresSession } from '../src/lib/auth/fastapi';
import { validateProductInput, validatePromotionalPrice } from '../src/modules/catalog/product-validation';
import { restoredCart } from '../src/modules/cart/cart-validation';
import { postgresTestUrl } from './helpers/postgres-test';
import { toStoreProduct } from '../src/modules/catalog/catalog-api.adapter';

process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'isolated-unit-test-secret';

test('guest order tokens are signed, bound to the order and expire', () => {
  const token = grantGuestOrder('order-1', 1_000);
  assert.equal(canReadGuestOrder(token, 'order-1', 1_000), true);
  assert.equal(canReadGuestOrder(token, 'order-2', 1_000), false);
  assert.equal(canReadGuestOrder(token, 'order-1', 3_601_001), false);
});

test('origin validation rejects cross-site requests', () => {
  assert.equal(sameOrigin(new Request('http://localhost/api', { headers: { origin: 'http://localhost' } })), true);
  assert.equal(sameOrigin(new Request('http://localhost/api', { headers: { origin: 'https://evil.example' } })), false);
  assert.equal(sameOrigin(new Request('http://localhost:3000/api', { headers: { origin: 'http://127.0.0.1:3000' } })), true);
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  try {
    process.env.NEXT_PUBLIC_APP_URL = 'http://127.0.0.1:3000';
    assert.equal(sameOrigin(new Request('http://localhost:3000/api', { headers: { origin: 'http://127.0.0.1:3000' } })), true);
    assert.equal(checkOrigin(new Request('http://localhost:3000/api')).allowed, false);
    const rejected = checkOrigin(new Request('http://localhost:3000/api', { headers: { origin: 'https://evil.example' } }));
    assert.equal(rejected.receivedOrigin, 'https://evil.example');
    assert.equal(rejected.requestOrigin, 'http://localhost:3000');
    assert.equal(rejected.expectedOrigin, 'http://127.0.0.1:3000');
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  }
});

test('origin validation accepts only explicitly configured tunnel origins', () => {
  const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const previousAllowed = process.env.FOCUS_ALLOWED_ORIGINS;
  try {
    process.env.NEXT_PUBLIC_APP_URL = 'http://127.0.0.1:3000';
    process.env.FOCUS_ALLOWED_ORIGINS = 'https://tunnel.example';
    assert.equal(checkOrigin(new Request('http://127.0.0.1:3000/api', {
      headers: { origin: 'https://tunnel.example' },
    })).allowed, true);
    assert.equal(checkOrigin(new Request('http://127.0.0.1:3000/api', {
      headers: { origin: 'https://untrusted.example' },
    })).allowed, false);
  } finally {
    if (previousAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
    if (previousAllowed === undefined) delete process.env.FOCUS_ALLOWED_ORIGINS;
    else process.env.FOCUS_ALLOWED_ORIGINS = previousAllowed;
  }
});

test('keeps PostgreSQL sessions on the PostgreSQL identity boundary', () => {
  assert.equal(isPostgresSession('pg_session-token'), true);
  assert.equal(isPostgresSession('legacy-session-token'), false);
  assert.equal(isPostgresSession(undefined), false);
});

test('copies FastAPI cookies with Headers as the getSetCookie receiver', () => {
  const sourceHeaders = {
    getSetCookie(this: object) {
      assert.equal(this, sourceHeaders);
      return ['focus_session=pg_test; Path=/; HttpOnly; SameSite=lax'];
    },
  };
  const target = new Response();
  copySetCookie({ headers: sourceHeaders } as unknown as Response, target);
  assert.equal(target.headers.get('set-cookie'), 'focus_session=pg_test; Path=/; HttpOnly; SameSite=lax');
});

test('product validation rejects invalid prices and stock', () => {
  assert.throws(() => validateProductInput({ name: 'X', sku: 'X', basePrice: -1 }));
  assert.throws(() => validateProductInput({ name: 'X', sku: 'X', basePrice: 10, promotionalPrice: 11 }));
  assert.throws(() => validateProductInput({ name: 'X', sku: 'X', basePrice: 10, variants: [{ stock: -1 }] }));
  assert.equal(validatePromotionalPrice(10, 0), 0);
});

test('malformed cart data is discarded instead of being trusted', () => {
  assert.deepEqual(restoredCart([{ variantId: 'v', quantity: 1 }]), [{ variantId: 'v', quantity: 1 }]);
  assert.deepEqual(restoredCart([{ variantId: 'v', quantity: -1 }]), []);
  assert.deepEqual(restoredCart({}), []);
});

test('test database helper rejects remote PostgreSQL targets', () => {
  const previous = process.env.FOCUS_TEST_DATABASE_URL;
  try {
    process.env.FOCUS_TEST_DATABASE_URL = 'postgresql://test:test@db.example/focusstore_test';
    assert.throws(() => postgresTestUrl('unit'), /host PostgreSQL local autorizado/);
  } finally {
    if (previous === undefined) delete process.env.FOCUS_TEST_DATABASE_URL;
    else process.env.FOCUS_TEST_DATABASE_URL = previous;
  }
});

test('catalog API adapter preserves the fields used by the existing storefront', () => {
  const product = toStoreProduct({
    id: 'product-1', name: 'Produto', slug: 'produto', sku: 'SKU-1',
    description: 'Descrição', short_description: null, brand: 'Focus', status: 'ACTIVE',
    base_price: 99.9, promotional_price: null, available: true,
    primary_image: null, images: [{ id: 'image-1', url: '/image.webp', alt_text: 'Frente', position: 0, is_primary: true }],
    categories: [{ id: 'category-1', name: 'Categoria', slug: 'categoria', description: null, image_url: null, parent_id: null, position: 0 }],
    variants: [{ id: 'variant-1', sku: 'SKU-1-B', name: 'Padrão', color: null, color_hex: null,
      size: null, model: null, price: 99.9, promotional_price: null, image_url: null, position: 0,
      quantity_available: 2, quantity_reserved: 0, available: true }],
  });
  assert.equal(product.images[0].altText, 'Frente');
  assert.equal(product.categories[0].category.slug, 'categoria');
  assert.equal(product.variants[0].inventory.quantityAvailable, 2);
});
