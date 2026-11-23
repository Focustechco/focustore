import { catalogMinorUnits } from '@/lib/api/catalog-money';
import type { CatalogCategoryResponse, CatalogPageResponse, CatalogProductResponse, CatalogVariantResponse } from '@/lib/api/focus-api';

/** FastAPI omits collections, reviews, isFeatured and createdAt; those remain Prisma-only. */
export type StorefrontCategory = { id: string; name: string; slug: string; description: string | null; imageUrl: string | null; parentId: string | null; position: number };
export type StorefrontProduct = {
  catalogOrigin?: 'legacy_sqlite' | 'postgresql'; basePriceMinor?: number; promotionalPriceMinor?: number | null;
  id: string; publicId?: string; name: string; slug: string; sku: string; description: string; shortDescription: string | null; brand: string; status: string; basePrice: number; promotionalPrice: number | null; available?: boolean; updatedAt?: Date; catalogSource?: 'fastapi' | 'prisma';
  images: { id: string; url: string; altText: string | null; position: number; isPrimary: boolean }[];
  categories: { productId: string; categoryId: string; category: StorefrontCategory }[];
  variants: { priceMinor?: number; promotionalPriceMinor?: number | null; id: string; publicId?: string; sku: string; name: string; color: string | null; colorHex: string | null; size: string | null; model: string | null; price: number; promotionalPrice: number | null; imageUrl: string | null; position: number; inventory: { quantityAvailable: number | null; quantityReserved: number | null } | null; available?: boolean }[];
};
export type StorefrontPage<T> = { items: T[]; total: number; offset: number; limit: number };
export function adaptCatalogCategory(category: CatalogCategoryResponse): StorefrontCategory {
  return { id: category.id, name: category.name, slug: category.slug, description: category.description,
    imageUrl: category.image_url, parentId: category.parent_id, position: category.position };
}

function adaptVariant(variant: CatalogVariantResponse): StorefrontProduct['variants'][number] {
  const priceMinor = catalogMinorUnits(variant.price);
  const promotionalPriceMinor = variant.promotional_price === null ? null : catalogMinorUnits(variant.promotional_price);
  return {
    id: variant.id, publicId: variant.public_id ?? undefined, sku: variant.sku, name: variant.name,
    color: variant.color, colorHex: variant.color_hex, size: variant.size, model: variant.model,
    priceMinor, promotionalPriceMinor,
    price: priceMinor / 100, promotionalPrice: promotionalPriceMinor === null ? null : promotionalPriceMinor / 100,
    imageUrl: variant.image_url, position: variant.position,
    inventory: variant.quantity_available === null && variant.quantity_reserved === null ? null : {
      quantityAvailable: variant.quantity_available, quantityReserved: variant.quantity_reserved,
    },
    available: variant.available,
  };
}

export function adaptCatalogProduct(product: CatalogProductResponse): StorefrontProduct {
  const basePriceMinor = catalogMinorUnits(product.base_price);
  const promotionalPriceMinor = product.promotional_price === null ? null : catalogMinorUnits(product.promotional_price);
  return {
    id: product.id, publicId: product.public_id ?? undefined,
    catalogOrigin: product.catalog_origin ?? undefined, catalogSource: 'fastapi',
    name: product.name, slug: product.slug, sku: product.sku, description: product.description,
    shortDescription: product.short_description, brand: product.brand, status: product.status,
    basePriceMinor, promotionalPriceMinor, basePrice: basePriceMinor / 100,
    promotionalPrice: promotionalPriceMinor === null ? null : promotionalPriceMinor / 100,
    available: product.available,
    images: [...product.images].sort((a, b) => a.position - b.position).map(image => ({
      id: image.id, url: image.url, altText: image.alt_text, position: image.position, isPrimary: image.is_primary,
    })),
    categories: product.categories.map(category => ({
      productId: product.id, categoryId: category.id, category: adaptCatalogCategory(category),
    })),
    variants: [...product.variants].sort((a, b) => a.position - b.position).map(adaptVariant),
  };
}

export function adaptCatalogPage<T, U>(page: CatalogPageResponse<T>, adapt: (item: T) => U): StorefrontPage<U> {
  return { items: page.items.map(adapt), total: page.total, offset: page.offset, limit: page.limit };
}
