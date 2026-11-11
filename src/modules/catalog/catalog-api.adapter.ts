import type { CatalogCategoryResponse, CatalogPageResponse, CatalogProductResponse } from '@/lib/api/focus-api';

/** FastAPI omits collections, reviews, isFeatured and createdAt; those remain Prisma-only. */
export type StorefrontCategory = { id: string; name: string; slug: string; description: string | null; imageUrl: string | null; parentId: string | null; position: number };
export type StorefrontProduct = {
  id: string; name: string; slug: string; sku: string; description: string; shortDescription: string | null; brand: string; status: string; basePrice: number; promotionalPrice: number | null; available?: boolean; updatedAt?: Date;
  images: { id: string; url: string; altText: string | null; position: number; isPrimary: boolean }[];
  categories: { productId: string; categoryId: string; category: StorefrontCategory }[];
  variants: { id: string; sku: string; name: string; color: string | null; colorHex: string | null; size: string | null; model: string | null; price: number; promotionalPrice: number | null; imageUrl: string | null; position: number; inventory: { quantityAvailable: number | null; quantityReserved: number | null } | null; available?: boolean }[];
};
export type StorefrontPage<T> = { items: T[]; total: number; offset: number; limit: number };
function decimalToNumber(value: string | number, field: string): number { const result = typeof value === 'number' ? value : Number(value); if (!Number.isFinite(result)) throw new Error(`FastAPI returned an invalid monetary value for ${field}.`); return result; }
export function adaptCatalogCategory(category: CatalogCategoryResponse): StorefrontCategory { return { id: category.id, name: category.name, slug: category.slug, description: category.description, imageUrl: category.image_url, parentId: category.parent_id, position: category.position }; }
export function adaptCatalogProduct(product: CatalogProductResponse): StorefrontProduct {
  return {
    id: product.id, name: product.name, slug: product.slug, sku: product.sku, description: product.description, shortDescription: product.short_description, brand: product.brand, status: product.status, basePrice: decimalToNumber(product.base_price, 'product.base_price'), promotionalPrice: product.promotional_price === null ? null : decimalToNumber(product.promotional_price, 'product.promotional_price'), available: product.available,
    images: [...product.images].sort((a, b) => a.position - b.position).map(image => ({ id: image.id, url: image.url, altText: image.alt_text, position: image.position, isPrimary: image.is_primary })),
    categories: product.categories.map(category => ({ productId: product.id, categoryId: category.id, category: adaptCatalogCategory(category) })),
    variants: [...product.variants].sort((a, b) => a.position - b.position).map(variant => ({ id: variant.id, sku: variant.sku, name: variant.name, color: variant.color, colorHex: variant.color_hex, size: variant.size, model: variant.model, price: decimalToNumber(variant.price, 'variant.price'), promotionalPrice: variant.promotional_price === null ? null : decimalToNumber(variant.promotional_price, 'variant.promotional_price'), imageUrl: variant.image_url, position: variant.position, inventory: variant.quantity_available === null && variant.quantity_reserved === null ? null : { quantityAvailable: variant.quantity_available, quantityReserved: variant.quantity_reserved }, available: variant.available })),
  };
}
export function adaptCatalogPage<T, U>(page: CatalogPageResponse<T>, adapt: (item: T) => U): StorefrontPage<U> { return { items: page.items.map(adapt), total: page.total, offset: page.offset, limit: page.limit }; }
