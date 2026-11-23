/** Exact BRL cents at the read boundary. Existing number fields are display-only. */
export function catalogMinorUnits(value: string | number): number {
  const text = String(value);
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new RangeError('Invalid non-negative catalog money');
  const [whole, fraction = ''] = text.split('.');
  const cents = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2))
    + (Number(fraction[2] ?? '0') >= 5 ? 1n : 0n);
  if (cents > 9_999_999_999n) throw new RangeError('Catalog money exceeds Numeric(10,2)');
  return Number(cents);
}
