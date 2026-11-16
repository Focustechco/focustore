'use client';

export function CatalogRetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="mt-6 inline-flex rounded-md border border-white/20 px-4 py-2 text-xs font-bold uppercase text-white transition-colors hover:border-focus hover:text-focus"
    >
      Tentar novamente
    </button>
  );
}
