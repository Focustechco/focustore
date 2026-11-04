import type { CartItem } from './cart-context';

const MAX_CART_ITEMS = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function restoredCart(value: unknown): CartItem[] {
  if (!Array.isArray(value) || value.length > MAX_CART_ITEMS) return [];

  return value.filter((item): item is CartItem => {
    if (!isRecord(item)) return false;

    return (
      typeof item.variantId === 'string' &&
      item.variantId.length > 0 &&
      typeof item.productId === 'string' &&
      typeof item.name === 'string' &&
      typeof item.variantName === 'string' &&
      typeof item.sku === 'string' &&
      typeof item.quantity === 'number' &&
      Number.isSafeInteger(item.quantity) &&
      item.quantity > 0 &&
      typeof item.price === 'number' &&
      Number.isFinite(item.price) &&
      item.price >= 0 &&
      (item.promotionalPrice === undefined ||
        item.promotionalPrice === null ||
        (typeof item.promotionalPrice === 'number' &&
          Number.isFinite(item.promotionalPrice) &&
          item.promotionalPrice >= 0 &&
          item.promotionalPrice < item.price)) &&
      (item.imageUrl === undefined || item.imageUrl === null || typeof item.imageUrl === 'string') &&
      (item.size === undefined || item.size === null || typeof item.size === 'string') &&
      (item.color === undefined || item.color === null || typeof item.color === 'string')
    );
  });
}
