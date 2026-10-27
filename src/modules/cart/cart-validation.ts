import { z } from 'zod';

const itemSchema = z.object({
  variantId: z.string().min(1), productId: z.string().min(1), name: z.string().min(1),
  variantName: z.string(), sku: z.string(), quantity: z.number().int().min(1).max(10000),
  price: z.number().finite().nonnegative(), promotionalPrice: z.number().finite().positive().nullish(),
  imageUrl: z.string().nullish(), size: z.string().nullish(), color: z.string().nullish(),
});

export function validCartItem(value: unknown) {
  return itemSchema.safeParse(value);
}

export function restoredCart(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap(item => {
    const parsed = validCartItem(item);
    return parsed.success ? [parsed.data] : [];
  });
}
