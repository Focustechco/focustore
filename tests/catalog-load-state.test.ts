import assert from 'node:assert/strict';
import test from 'node:test';
import { FocusApiError } from '../src/lib/api/focus-api';
import { catalogCountLabel, settleCatalogResult } from '../src/modules/catalog/catalog-load-state';

test('HTTP, timeout and network failures are unavailable, never empty', () => {
  const failures = [
    new FocusApiError('HTTP 503', 'http', 503),
    new FocusApiError('timeout', 'timeout'),
    new FocusApiError('offline', 'network'),
  ];
  for (const error of failures) {
    const state = settleCatalogResult({ status: 'rejected', reason: error });
    assert.equal(state.status, 'unavailable');
    assert.equal(catalogCountLabel(0, state), 'Catálogo indisponível');
  }
});

test('an empty successful response remains a legitimate empty catalog', () => {
  const state = settleCatalogResult({ status: 'fulfilled', value: [] as const });
  assert.equal(state.status, 'empty');
  assert.equal(catalogCountLabel(0, state), '0 produtos encontrados');
});

test('a later successful response recovers after an unavailable response', () => {
  const unavailable = settleCatalogResult({ status: 'rejected', reason: new Error('offline') });
  const recovered = settleCatalogResult({ status: 'fulfilled', value: ['product'] as const });
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(recovered.status, 'ready');
  assert.equal(catalogCountLabel(recovered.value.length, recovered), '1 produto encontrado');
});
