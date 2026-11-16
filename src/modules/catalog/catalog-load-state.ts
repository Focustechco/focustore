export type CatalogLoadState<T> =
  | { status: 'ready'; value: T }
  | { status: 'empty'; value: T }
  | { status: 'unavailable'; error: unknown };

export function settleCatalogResult<T extends readonly unknown[]>(
  result: PromiseSettledResult<T>,
): CatalogLoadState<T> {
  if (result.status === 'rejected') return { status: 'unavailable', error: result.reason };
  return result.value.length === 0
    ? { status: 'empty', value: result.value }
    : { status: 'ready', value: result.value };
}

export function catalogCountLabel(count: number, state: CatalogLoadState<readonly unknown[]>): string {
  if (state.status === 'unavailable') return 'Catálogo indisponível';
  return `${count} ${count === 1 ? 'produto encontrado' : 'produtos encontrados'}`;
}
