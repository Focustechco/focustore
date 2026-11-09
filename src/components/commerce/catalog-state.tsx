import Link from 'next/link';

export function CatalogErrorState() {
  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-12 text-center">
      <h2 className="text-lg font-bold uppercase text-white">Catálogo indisponível</h2>
      <p className="mt-2 text-sm text-zinc-300">
        Não foi possível carregar os produtos agora. Tente novamente em instantes.
      </p>
      <Link href="/categoria/todos" className="mt-5 inline-block text-xs font-bold uppercase text-[#FF6500] hover:underline">
        Tentar novamente
      </Link>
    </div>
  );
}
