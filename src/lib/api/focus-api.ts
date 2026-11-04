import { z } from 'zod';

const ApiImageSchema = z.object({
  id: z.string(),
  url: z.string(),
  alt_text: z.string().nullable(),
  position: z.number().int(),
  is_primary: z.boolean(),
});

const ApiCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  image_url: z.string().nullable(),
  parent_id: z.string().nullable(),
  position: z.number().int(),
});

const ApiVariantSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  color_hex: z.string().nullable(),
  size: z.string().nullable(),
  model: z.string().nullable(),
  price: z.coerce.number().nonnegative(),
  promotional_price: z.coerce.number().nonnegative().nullable(),
  image_url: z.string().nullable(),
  position: z.number().int(),
  quantity_available: z.number().int().nonnegative().nullable(),
  quantity_reserved: z.number().int().nonnegative().nullable(),
  available: z.boolean(),
});

export const ApiProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  sku: z.string(),
  description: z.string(),
  short_description: z.string().nullable(),
  brand: z.string(),
  status: z.string(),
  base_price: z.coerce.number().nonnegative(),
  promotional_price: z.coerce.number().nonnegative().nullable(),
  available: z.boolean(),
  primary_image: ApiImageSchema.nullable(),
  images: z.array(ApiImageSchema),
  categories: z.array(ApiCategorySchema),
  variants: z.array(ApiVariantSchema),
});

const ApiPageSchema = z.object({
  items: z.array(ApiProductSchema),
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});

const ApiCategoryPageSchema = z.object({
  items: z.array(ApiCategorySchema),
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});

export type FocusApiProduct = z.infer<typeof ApiProductSchema>;
export type FocusApiCategory = z.infer<typeof ApiCategorySchema>;

export class FocusApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'FocusApiError';
  }
}

function apiBaseUrl(): string {
  const value = process.env.FOCUS_FASTAPI_BASE_URL?.trim();
  if (!value) throw new FocusApiError(503, 'API FocusStore não configurada.');
  return value.replace(/\/$/, '');
}

async function getJson(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new FocusApiError(response.status, 'API FocusStore indisponível.');
    return await response.json();
  } catch (error) {
    if (error instanceof FocusApiError) throw error;
    throw new FocusApiError(503, 'API FocusStore indisponível.');
  } finally {
    clearTimeout(timeout);
  }
}

export const isFastApiCatalogEnabled = process.env.FOCUS_CATALOG_SOURCE === 'fastapi';

export async function fetchCatalogProducts(): Promise<FocusApiProduct[]> {
  const firstPage = ApiPageSchema.parse(await getJson('/api/v1/catalog/products?offset=0&limit=100'));
  const products = [...firstPage.items];
  for (let offset = firstPage.items.length; offset < firstPage.total; offset += firstPage.limit) {
    const page = ApiPageSchema.parse(
      await getJson(`/api/v1/catalog/products?offset=${offset}&limit=${firstPage.limit}`)
    );
    products.push(...page.items);
  }
  return products;
}

export async function fetchCatalogProduct(slug: string): Promise<FocusApiProduct | null> {
  try {
    return ApiProductSchema.parse(await getJson(`/api/v1/catalog/products/${encodeURIComponent(slug)}`));
  } catch (error) {
    if (error instanceof FocusApiError && error.status === 404) return null;
    throw error;
  }
}

export async function fetchCatalogCategories(): Promise<FocusApiCategory[]> {
  const payload = ApiCategoryPageSchema.parse(await getJson('/api/v1/catalog/categories?offset=0&limit=100'));
  return payload.items;
}
