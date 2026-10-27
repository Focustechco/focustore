import { z } from 'zod';
import { InputError } from '@/lib/security/input-error';

const amount = z.coerce.number().finite().positive().max(99999999.99)
  .refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, 'Preço deve ter até dois decimais.');
const optionalAmount = z.preprocess(v => v === '' ? null : v, amount.nullable().optional());
const quantity = z.coerce.number().int().min(0).max(2147483647);
const optionalText = (max: number) => z.preprocess(
  value => value === '' ? undefined : value,
  z.string().trim().min(1).max(max).optional(),
);
const image = z.union([
  z.string().min(1).max(2048),
  z.object({ url: z.string().min(1).max(2048), altText: z.string().max(300).nullish() }),
]);
const variant = z.object({
  id: z.string().min(1).optional(), sku: optionalText(100),
  name: optionalText(200), color: z.string().max(100).nullish(),
  colorHex: z.string().max(20).nullish(), size: z.string().max(100).nullish(),
  model: z.string().max(100).nullish(), price: amount.optional(),
  promotionalPrice: optionalAmount, imageUrl: z.string().max(2048).nullish(),
  stock: quantity.optional(), quantityAvailable: quantity.optional(), isActive: z.boolean().optional(),
});
const fields = z.object({
  name: z.string().trim().min(1).max(200), sku: z.string().trim().min(1).max(100),
  slug: optionalText(200),
  description: z.string().max(50000).optional(), shortDescription: z.string().max(1000).nullish(),
  brand: z.string().max(100).optional(), basePrice: amount,
  promotionalPrice: optionalAmount, costPrice: optionalAmount,
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(), isFeatured: z.boolean().optional(),
  weightGrams: quantity.optional(), heightCm: quantity.optional(), widthCm: quantity.optional(), lengthCm: quantity.optional(),
  categoryIds: z.array(z.string().min(1)).max(100).optional(),
  collectionIds: z.array(z.string().min(1)).max(100).optional(),
  images: z.array(image).max(100).optional(), variants: z.array(variant).max(100).optional(),
});

export function validateProductInput(input: unknown, partial = false) {
  const parsed = (partial ? fields.partial() : fields).safeParse(input);
  if (!parsed.success) throw new InputError('Dados de produto inválidos. Confira preços, estoque e campos obrigatórios.');
  return parsed.data;
}

export function validatePromotionalPrice(base: number, promotional: number | null | undefined) {
  if (promotional != null && promotional >= base) throw new InputError('Preço promocional deve ser menor que o preço base.');
}
