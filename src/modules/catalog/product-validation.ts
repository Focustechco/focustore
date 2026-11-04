import { isFiniteNumberLike, isNonEmptyString, isNonNegativeIntegerLike } from '@/lib/security/input';

export function validatePromotionalPrice(basePrice: unknown, promotionalPrice: unknown): number | null {
  if (promotionalPrice === undefined || promotionalPrice === null || promotionalPrice === '') return null;
  if (!isFiniteNumberLike(basePrice) || !isFiniteNumberLike(promotionalPrice)) throw new Error('Preço inválido.');
  const base = Number(basePrice);
  const promotion = Number(promotionalPrice);
  if (base <= 0 || promotion < 0 || promotion > base) throw new Error('Preço promocional inválido.');
  return promotion;
}

export function validateProductInput(input: any) {
  if (!input || !isNonEmptyString(input.name, 150) || !isNonEmptyString(input.sku, 120) ||
    !isFiniteNumberLike(input.basePrice) || Number(input.basePrice) <= 0) throw new Error('Produto inválido.');
  validatePromotionalPrice(input.basePrice, input.promotionalPrice);
  if (input.variants !== undefined) {
    if (!Array.isArray(input.variants)) throw new Error('Variantes inválidas.');
    for (const variant of input.variants) {
      if (!variant || (variant.stock !== undefined && !isNonNegativeIntegerLike(variant.stock))) throw new Error('Estoque inválido.');
      if (variant.price !== undefined && (!isFiniteNumberLike(variant.price) || Number(variant.price) <= 0)) throw new Error('Preço da variante inválido.');
      if (variant.promotionalPrice !== undefined) validatePromotionalPrice(variant.price ?? input.basePrice, variant.promotionalPrice);
    }
  }
  return {
    ...input,
    slug: input.slug?.trim() || undefined,
    variants: input.variants?.map((variant: any) => ({ ...variant, sku: variant.sku?.trim() || undefined, name: variant.name?.trim() || undefined })),
  };
}
