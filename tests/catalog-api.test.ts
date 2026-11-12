import assert from 'node:assert/strict';
import test from 'node:test';
import { FocusApiClient, FocusApiError, type CatalogProductResponse } from '../src/lib/api/focus-api';
import { adaptCatalogCategory, adaptCatalogPage, adaptCatalogProduct } from '../src/modules/catalog/catalog-api.adapter';

function productFixture(): CatalogProductResponse {
  return {
    id: 'product-1', name: 'Focus bottle', slug: 'focus-bottle', sku: 'BOTTLE-1', description: 'Synthetic product', short_description: null, brand: 'Focus', status: 'ACTIVE', base_price: '129.90', promotional_price: '99.90', available: true,
    primary_image: { id: 'image-2', url: '/two.png', alt_text: null, position: 2, is_primary: true },
    images: [
      { id: 'image-2', url: '/two.png', alt_text: null, position: 2, is_primary: true },
      { id: 'image-1', url: '/one.png', alt_text: 'Front', position: 1, is_primary: false },
    ],
    categories: [{ id: 'category-1', name: 'Accessories', slug: 'accessories', description: null, image_url: null, parent_id: null, position: 3 }],
    variants: [{ id: 'variant-1', sku: 'BOTTLE-1-BLACK', name: 'Black', color: 'Black', color_hex: '#000000', size: null, model: null, price: '129.90', promotional_price: null, image_url: null, position: 1, quantity_available: 3, quantity_reserved: 1, available: true }],
  };
}

test('adapter converts FastAPI product fields, relations, images and inventory', () => {
  const product = adaptCatalogProduct(productFixture());
  assert.equal(product.catalogSource, 'fastapi');
  assert.equal(product.basePrice, 129.90);
  assert.equal(product.promotionalPrice, 99.90);
  assert.deepEqual(product.images.map(image => image.id), ['image-1', 'image-2']);
  assert.equal(product.categories[0].categoryId, 'category-1');
  assert.equal(product.categories[0].category.slug, 'accessories');
  assert.deepEqual(product.variants[0].inventory, { quantityAvailable: 3, quantityReserved: 1 });
});

test('adapter preserves null optional fields and paginated metadata', () => {
  const category = adaptCatalogCategory(productFixture().categories[0]);
  assert.equal(category.description, null);
  assert.equal(category.imageUrl, null);
  const page = adaptCatalogPage({ items: [productFixture()], total: 7, offset: 4, limit: 2 }, adaptCatalogProduct);
  assert.deepEqual({ total: page.total, offset: page.offset, limit: page.limit }, { total: 7, offset: 4, limit: 2 });
  assert.equal(page.items.length, 1);
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

test('FastAPI client encodes product slugs and returns null only for HTTP 404 details', async () => {
  let requested = '';
  const client = new FocusApiClient({ baseUrl: 'http://catalog.test', fetch: async input => { requested = String(input); return new Response('', { status: 404 }); } });
  assert.equal(await client.getProduct('space / slash'), null);
  assert.match(requested, /space%20%2F%20slash$/);
});
