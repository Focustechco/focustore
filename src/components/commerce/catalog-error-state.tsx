import Link from 'next/link';
import { CatalogRetryButton } from './catalog-retry-button';

export function CatalogErrorState() {
  return (
    <div className="rounded-2xl border border-red-400/20 bg-red-950/20 px-6 py-16 text-center">
      <h2 className="text-lg font-bold uppercase text-white">Catálogo temporariamente indisponível</h2>
      <p className="mx-auto mt-3 max-w-lg text-sm text-zinc-400">
        Não foi possível consultar o catálogo agora. Tente novamente em instantes.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <CatalogRetryButton />
        <Link href="/" className="mt-6 inline-block text-xs font-bold uppercase text-focus hover:underline">
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
