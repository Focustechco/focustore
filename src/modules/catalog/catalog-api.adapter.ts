import type { FocusApiCategory, FocusApiProduct } from '@/lib/api/focus-api';

export function toStoreCategory(category: FocusApiCategory) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    imageUrl: category.image_url,
    parentId: category.parent_id,
    position: category.position,
  };
}

export function toStoreProduct(product: FocusApiProduct) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description,
    shortDescription: product.short_description,
    brand: product.brand,
    status: product.status,
    basePrice: product.base_price,
    promotionalPrice: product.promotional_price,
    images: product.images.map((image) => ({
      id: image.id,
      url: image.url,
      altText: image.alt_text,
      position: image.position,
      isPrimary: image.is_primary,
    })),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      color: variant.color,
      colorHex: variant.color_hex,
      size: variant.size,
      model: variant.model,
      price: variant.price,
      promotionalPrice: variant.promotional_price,
      imageUrl: variant.image_url,
      position: variant.position,
      inventory: {
        quantityAvailable: variant.quantity_available ?? 0,
        quantityReserved: variant.quantity_reserved ?? 0,
      },
    })),
    categories: product.categories.map((category) => ({
      categoryId: category.id,
      category: toStoreCategory(category),
    })),
    collections: [],
    updatedAt: new Date(0),
    available: product.available,
  };
}
