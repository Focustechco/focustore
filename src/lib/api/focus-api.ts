/** Server-side client for FocusStore's public FastAPI catalog contract. */

export type CatalogImageResponse = { id: string; url: string; alt_text: string | null; position: number; is_primary: boolean };
export type CatalogCategoryResponse = { id: string; name: string; slug: string; description: string | null; image_url: string | null; parent_id: string | null; position: number };
export type CatalogVariantResponse = {
  id: string; public_id?: string | null; sku: string; name: string; color: string | null; color_hex: string | null; size: string | null; model: string | null;
  price: string | number; promotional_price: string | number | null; image_url: string | null; position: number;
  quantity_available: number | null; quantity_reserved: number | null; available: boolean;
};
export type CatalogProductResponse = {
  id: string; public_id?: string | null; name: string; slug: string; sku: string; description: string; short_description: string | null; brand: string; status: string;
  base_price: string | number; promotional_price: string | number | null; available: boolean; primary_image: CatalogImageResponse | null;
  images: CatalogImageResponse[]; categories: CatalogCategoryResponse[]; variants: CatalogVariantResponse[];
};
export type CatalogPageResponse<T> = { items: T[]; total: number; offset: number; limit: number };
export type CatalogProductQuery = {
  categorySlug?: string;
  search?: string;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'newest';
  minPrice?: number;
  maxPrice?: number;
};

export class FocusApiError extends Error {
  constructor(message: string, readonly kind: 'configuration' | 'http' | 'network' | 'timeout' | 'response', readonly status?: number) {
    super(message); this.name = 'FocusApiError';
  }
}

type FetchLike = typeof fetch;
export type FocusApiClientOptions = { baseUrl?: string; timeoutMs?: number; fetch?: FetchLike };
const DEFAULT_TIMEOUT_MS = 5_000;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new FocusApiError(`Unexpected FastAPI response: ${label} must be an object.`, 'response');
  return value as Record<string, unknown>;
}
function string(value: unknown, label: string): string { if (typeof value !== 'string') throw new FocusApiError(`Unexpected FastAPI response: ${label} must be a string.`, 'response'); return value; }
function number(value: unknown, label: string): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new FocusApiError(`Unexpected FastAPI response: ${label} must be a finite number.`, 'response'); return value; }
function boolean(value: unknown, label: string): boolean { if (typeof value !== 'boolean') throw new FocusApiError(`Unexpected FastAPI response: ${label} must be a boolean.`, 'response'); return value; }
function nullableString(value: unknown, label: string): string | null { return value === null ? null : string(value, label); }
function nullableNumber(value: unknown, label: string): number | null { return value === null ? null : number(value, label); }
function money(value: unknown, label: string): string | number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value)) return value;
  throw new FocusApiError(`Unexpected FastAPI response: ${label} must be a non-negative decimal.`, 'response');
}
function nullableMoney(value: unknown, label: string): string | number | null { return value === null ? null : money(value, label); }

export function parseCatalogImage(value: unknown): CatalogImageResponse {
  const item = record(value, 'image');
  return { id: string(item.id, 'image.id'), url: string(item.url, 'image.url'), alt_text: nullableString(item.alt_text, 'image.alt_text'), position: number(item.position, 'image.position'), is_primary: boolean(item.is_primary, 'image.is_primary') };
}
export function parseCatalogCategory(value: unknown): CatalogCategoryResponse {
  const item = record(value, 'category');
  return { id: string(item.id, 'category.id'), name: string(item.name, 'category.name'), slug: string(item.slug, 'category.slug'), description: nullableString(item.description, 'category.description'), image_url: nullableString(item.image_url, 'category.image_url'), parent_id: nullableString(item.parent_id, 'category.parent_id'), position: number(item.position, 'category.position') };
}
function parseCatalogVariant(value: unknown): CatalogVariantResponse {
  const item = record(value, 'variant');
  return { id: string(item.id, 'variant.id'), public_id: item.public_id === undefined ? undefined : nullableString(item.public_id, 'variant.public_id'), sku: string(item.sku, 'variant.sku'), name: string(item.name, 'variant.name'), color: nullableString(item.color, 'variant.color'), color_hex: nullableString(item.color_hex, 'variant.color_hex'), size: nullableString(item.size, 'variant.size'), model: nullableString(item.model, 'variant.model'), price: money(item.price, 'variant.price'), promotional_price: nullableMoney(item.promotional_price, 'variant.promotional_price'), image_url: nullableString(item.image_url, 'variant.image_url'), position: number(item.position, 'variant.position'), quantity_available: nullableNumber(item.quantity_available, 'variant.quantity_available'), quantity_reserved: nullableNumber(item.quantity_reserved, 'variant.quantity_reserved'), available: boolean(item.available, 'variant.available') };
}
export function parseCatalogProduct(value: unknown): CatalogProductResponse {
  const item = record(value, 'product');
  if (!Array.isArray(item.images) || !Array.isArray(item.categories) || !Array.isArray(item.variants)) throw new FocusApiError('Unexpected FastAPI response: product relations must be arrays.', 'response');
  return { id: string(item.id, 'product.id'), public_id: item.public_id === undefined ? undefined : nullableString(item.public_id, 'product.public_id'), name: string(item.name, 'product.name'), slug: string(item.slug, 'product.slug'), sku: string(item.sku, 'product.sku'), description: string(item.description, 'product.description'), short_description: nullableString(item.short_description, 'product.short_description'), brand: string(item.brand, 'product.brand'), status: string(item.status, 'product.status'), base_price: money(item.base_price, 'product.base_price'), promotional_price: nullableMoney(item.promotional_price, 'product.promotional_price'), available: boolean(item.available, 'product.available'), primary_image: item.primary_image === null ? null : parseCatalogImage(item.primary_image), images: item.images.map(parseCatalogImage), categories: item.categories.map(parseCatalogCategory), variants: item.variants.map(parseCatalogVariant) };
}
export function parseCatalogPage<T>(value: unknown, parseItem: (item: unknown) => T): CatalogPageResponse<T> {
  const page = record(value, 'page'); if (!Array.isArray(page.items)) throw new FocusApiError('Unexpected FastAPI response: page.items must be an array.', 'response');
  return { items: page.items.map(parseItem), total: number(page.total, 'page.total'), offset: number(page.offset, 'page.offset'), limit: number(page.limit, 'page.limit') };
}
function configuredBaseUrl(value: string | undefined): string {
  if (!value) throw new FocusApiError('FOCUS_API_BASE_URL is required when CATALOG_READ_SOURCE=fastapi.', 'configuration');
  let url: URL; try { url = new URL(value); } catch { throw new FocusApiError('FOCUS_API_BASE_URL must be an absolute HTTP(S) URL.', 'configuration'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash) throw new FocusApiError('FOCUS_API_BASE_URL must be a credential-free HTTP(S) origin or path.', 'configuration');
  return url.toString().replace(/\/$/, '');
}

export class FocusApiClient {
  private readonly baseUrl: string; private readonly timeoutMs: number; private readonly fetchImpl: FetchLike;
  constructor(options: FocusApiClientOptions = {}) { this.baseUrl = configuredBaseUrl(options.baseUrl ?? process.env.FOCUS_API_BASE_URL); this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS; this.fetchImpl = options.fetch ?? fetch; }
  listProducts(offset = 0, limit = 100, query: CatalogProductQuery = {}) {
    const params = new URLSearchParams();
    if (query.categorySlug && query.categorySlug !== 'todos') params.set('category_slug', query.categorySlug);
    if (query.search?.trim()) params.set('search', query.search.trim());
    if (query.sortBy) params.set('sort', query.sortBy);
    if (query.minPrice !== undefined) params.set('min_price', String(query.minPrice));
    if (query.maxPrice !== undefined) params.set('max_price', String(query.maxPrice));
    return this.getPage('/api/v1/catalog/products', offset, limit, parseCatalogProduct, params);
  }
  getProduct(slug: string) { return this.get(`/api/v1/catalog/products/${encodeURIComponent(slug)}`, parseCatalogProduct, true); }
  listCategories(offset = 0, limit = 100) { return this.getPage('/api/v1/catalog/categories', offset, limit, parseCatalogCategory); }
  getCategory(slug: string) { return this.get(`/api/v1/catalog/categories/${encodeURIComponent(slug)}`, parseCatalogCategory, true); }
  private getPage<T>(path: string, offset: number, limit: number, parseItem: (item: unknown) => T, query = new URLSearchParams()) {
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new FocusApiError('Catalog pagination must use offset >= 0 and limit between 1 and 100.', 'configuration');
    query.set('offset', String(offset)); query.set('limit', String(limit));
    return this.get(`${path}?${query}`, value => parseCatalogPage(value, parseItem), false) as Promise<CatalogPageResponse<T>>;
  }
  private async get<T>(path: string, parse: (value: unknown) => T, nullableNotFound: boolean): Promise<T | null> {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      let response: Response;
      try { response = await this.fetchImpl(`${this.baseUrl}${path}`, { method: 'GET', headers: { accept: 'application/json' }, cache: 'no-store', signal: controller.signal }); }
      catch { if (controller.signal.aborted) throw new FocusApiError(`FastAPI catalog timed out after ${this.timeoutMs}ms.`, 'timeout'); throw new FocusApiError('FastAPI catalog network request failed.', 'network'); }
      if (nullableNotFound && response.status === 404) return null;
      if (!response.ok) { const detail = (await response.text()).slice(0, 512); throw new FocusApiError(`FastAPI catalog returned HTTP ${response.status}${detail ? `: ${detail}` : ''}.`, 'http', response.status); }
      let body: unknown; try { body = await response.json(); } catch { throw new FocusApiError('FastAPI catalog returned invalid JSON.', 'response'); }
      return parse(body);
    } finally { clearTimeout(timeout); }
  }
}
