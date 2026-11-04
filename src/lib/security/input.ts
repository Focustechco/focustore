export function isFiniteNumberLike(value: unknown): value is number | string {
  if (typeof value !== 'number' && typeof value !== 'string') return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return Number.isFinite(Number(value));
}

export function isNonNegativeIntegerLike(value: unknown): value is number | string {
  return isFiniteNumberLike(value) && Number.isSafeInteger(Number(value)) && Number(value) >= 0;
}

export function isNonEmptyString(value: unknown, maxLength = 255): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}
