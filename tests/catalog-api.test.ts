import assert from 'node:assert/strict';
import test from 'node:test';
import { FocusApiClient, FocusApiError, parseCatalogProduct, parseCatalogPage, type CatalogProductResponse } from '../src/lib/api/focus-api';
import { adaptCatalogCategory, adaptCatalogPage, adaptCatalogProduct } from '../src/modules/catalog/catalog-api.adapter';

function productFixture(): CatalogProductResponse {
  return {
    id: 'product-1', public_id: '11111111-1111-4111-8111-111111111111', name: 'Focus bottle', slug: 'focus-bottle', sku: 'BOTTLE-1', description: 'Synthetic product', short_description: null, brand: 'Focus', status: 'ACTIVE', base_price: '129.90', promotional_price: '99.90', available: true,
    primary_image: { id: 'image-2', url: '/two.png', alt_text: null, position: 2, is_primary: true },
    images: [
      { id: 'image-2', url: '/two.png', alt_text: null, position: 2, is_primary: true },
      { id: 'image-1', url: '/one.png', alt_text: 'Front', position: 1, is_primary: false },
    ],
    categories: [{ id: 'category-1', name: 'Accessories', slug: 'accessories', description: null, image_url: null, parent_id: null, position: 3 }],
    variants: [{ id: 'variant-1', public_id: '22222222-2222-4222-8222-222222222222', sku: 'BOTTLE-1-BLACK', name: 'Black', color: 'Black', color_hex: '#000000', size: null, model: null, price: '129.90', promotional_price: null, image_url: null, position: 1, quantity_available: 3, quantity_reserved: 1, available: true }],
  };
}

test('catalog money rounds decimal half-up in integer cents without changing IDs', () => {
  const input = productFixture();
  input.base_price = '19.995';
  input.variants[0].price = '0.105';
  const result = adaptCatalogProduct(input);
  assert.equal(result.id, input.id);
  assert.equal(result.publicId, input.public_id);
  assert.equal(result.basePriceMinor, 2000);
  assert.equal(result.basePrice, 20);
  assert.equal(result.variants[0].priceMinor, 11);
  assert.equal(result.catalogSource, 'fastapi');
});

test('catalog read boundary rejects invalid UUIDs, quantities and page versions', () => {
  for (const invalid of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const input = productFixture();
    input.variants[0].quantity_available = invalid;
    assert.throws(() => parseCatalogProduct(input), FocusApiError);
  }
  assert.throws(() => parseCatalogProduct({ ...productFixture(), public_id: 'internal-integer-1' }), FocusApiError);
  for (const base_price of ['NaN', 'Infinity', '-1', '9999999999999999999']) {
    assert.throws(() => parseCatalogProduct({ ...productFixture(), base_price }), FocusApiError);
  }
  assert.throws(() => parseCatalogPage({ items: [], total: 0, offset: 0, limit: 0 }, parseCatalogProduct), FocusApiError);
  assert.throws(() => parseCatalogPage({ items: [], total: 1, offset: 0, limit: 20 }, parseCatalogProduct), FocusApiError);
  assert.throws(() => parseCatalogPage({ items: [], total: 0, offset: 0, limit: 1, contract_version: '2.0' }, parseCatalogProduct), FocusApiError);
  assert.equal(parseCatalogProduct({ ...productFixture(), public_id: null }).public_id, null);
});

test('adapter converts FastAPI product fields, relations, images and inventory', () => {
  const product = adaptCatalogProduct(productFixture());
  assert.equal(product.catalogSource, 'fastapi');
  assert.equal(product.publicId, '11111111-1111-4111-8111-111111111111');
  assert.equal(product.basePrice, 129.90);
  assert.equal(product.promotionalPrice, 99.90);
  assert.deepEqual(product.images.map(image => image.id), ['image-1', 'image-2']);
  assert.equal(product.categories[0].categoryId, 'category-1');
  assert.equal(product.categories[0].category.slug, 'accessories');
  assert.deepEqual(product.variants[0].inventory, { quantityAvailable: 3, quantityReserved: 1 });
  assert.equal(product.variants[0].publicId, '22222222-2222-4222-8222-222222222222');
});

test('adapter preserves null optional fields and paginated metadata', () => {
  const category = adaptCatalogCategory(productFixture().categories[0]);
  assert.equal(category.description, null);
  assert.equal(category.imageUrl, null);
  const page = adaptCatalogPage({ items: [productFixture()], total: 7, offset: 4, limit: 2 }, adaptCatalogProduct);
  assert.deepEqual({ total: page.total, offset: page.offset, limit: page.limit }, { total: 7, offset: 4, limit: 2 });
  assert.equal(page.items.length, 1);
});

test('adapter preserves a zero promotional price instead of treating it as absent', () => {
  const product = productFixture();
  product.promotional_price = '0.00';
  product.variants[0].promotional_price = '0.00';
  const adapted = adaptCatalogProduct(product);
  assert.equal(adapted.promotionalPrice, 0);
  assert.equal(adapted.variants[0].promotionalPrice, 0);
});

test('FastAPI client reports HTTP, network, timeout and invalid-response failures explicitly', async () => {
  const http = new FocusApiClient({ baseUrl: 'http://catalog.test', fetch: async () => new Response('unavailable', { status: 503 }) });
  await assert.rejects(http.listProducts(), (error: unknown) => error instanceof FocusApiError && error.kind === 'http' && error.status === 503);

  const network = new FocusApiClient({ baseUrl: 'http://catalog.test', fetch: async () => { throw new TypeError('offline'); } });
  await assert.rejects(network.listProducts(), (error: unknown) => error instanceof FocusApiError && error.kind === 'network');

  const timeout = new FocusApiClient({ baseUrl: 'http://catalog.test', timeoutMs: 5, fetch: async (_url, init) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))) });
  await assert.rejects(timeout.listProducts(), (error: unknown) => error instanceof FocusApiError && error.kind === 'timeout');

  const invalid = new FocusApiClient({ baseUrl: 'http://catalog.test', fetch: async () => new Response(JSON.stringify({ items: 'wrong' }), { status: 200, headers: { 'content-type': 'application/json' } }) });
  await assert.rejects(invalid.listProducts(), (error: unknown) => error instanceof FocusApiError && error.kind === 'response');
});

test('FastAPI client classifies protected, conflict, rate-limit and unavailable responses', async () => {
  for (const [status, category] of [[401, 'authentication'], [403, 'forbidden'], [409, 'conflict'], [422, 'validation'], [429, 'rate_limit'], [503, 'unavailable']] as const) {
    const client = new FocusApiClient({
      baseUrl: 'http://catalog.test',
      fetch: async () => new Response(JSON.stringify({ detail: 'bounded error' }), { status, headers: { 'retry-after': '12' } }),
    });
    await assert.rejects(client.listProducts(), (error: unknown) => error instanceof FocusApiError && error.category === category && error.status === status && (status === 429 ? error.retryAfterSeconds === 12 : true));
  }
});

test('FastAPI catalog requests omit browser credentials', async () => {
  let requestInit: RequestInit | undefined;
  const client = new FocusApiClient({
    baseUrl: 'http://catalog.test',
    fetch: async (_input, init) => {
      requestInit = init;
      return new Response(JSON.stringify({ items: [], total: 0, offset: 0, limit: 100 }), { status: 200 });
    },
  });
  await client.listProducts();
  assert.equal(requestInit?.credentials, 'omit');
});

test('upstream errors do not leak private diagnostic bodies or invent retry hints', async () => {
  const client = new FocusApiClient({ baseUrl: 'http://catalog.test', fetch: async () =>
    new Response('postgresql://user:synthetic-secret@private/database', { status: 503 }) });
  await assert.rejects(client.listProducts(), (error: unknown) => error instanceof FocusApiError
    && !error.message.includes('synthetic-secret') && !error.message.includes('private')
    && error.retryAfterSeconds === undefined);
});

test('FastAPI client encodes product slugs and returns null only for HTTP 404 details', async () => {
  let requested = '';
  const client = new FocusApiClient({ baseUrl: 'http://catalog.test', fetch: async input => { requested = String(input); return new Response('', { status: 404 }); } });
  assert.equal(await client.getProduct('space / slash'), null);
  assert.match(requested, /space%20%2F%20slash$/);
});

test('FastAPI client sends catalog filters to the server before pagination', async () => {
  let requested = '';
  const client = new FocusApiClient({
    baseUrl: 'http://catalog.test',
    fetch: async input => {
      requested = String(input);
      return new Response(JSON.stringify({ items: [], total: 0, offset: 20, limit: 10 }), { status: 200 });
    },
  });
  await client.listProducts(20, 10, { categorySlug: 'accessories', search: ' bottle ', sortBy: 'price_desc', minPrice: 10, maxPrice: 200 });
  const url = new URL(requested);
  assert.equal(url.searchParams.get('category_slug'), 'accessories');
  assert.equal(url.searchParams.get('search'), 'bottle');
  assert.equal(url.searchParams.get('sort'), 'price_desc');
  assert.equal(url.searchParams.get('min_price'), '10');
  assert.equal(url.searchParams.get('max_price'), '200');
  assert.equal(url.searchParams.get('offset'), '20');
  assert.equal(url.searchParams.get('limit'), '10');
});
