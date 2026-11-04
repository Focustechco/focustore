export function restoredCart(value: unknown): { variantId: string; quantity: number }[] {
  if (!Array.isArray(value)) return [];
  if (value.length > 100) return [];
  const result = value.filter((item): item is { variantId: string; quantity: number } => (
    !!item && typeof item === 'object' &&
    typeof (item as any).variantId === 'string' && (item as any).variantId.length <= 255 &&
    Number.isSafeInteger((item as any).quantity) && (item as any).quantity > 0 && (item as any).quantity <= 999
  ));
  return result.length === value.length ? result : [];
}
