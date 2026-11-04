import Link from 'next/link';
import { ArrowRight, Boxes, ExternalLink, Package } from 'lucide-react';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export default async function AdminCollectionsPage() {
  const collections = await prisma.collection.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-16 sm:p-8">
      <header className="space-y-2 border-b border-white/10 pb-5">
        <h1 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
          Coleções ({collections.length})
        </h1>
        <p className="text-xs text-zinc-400">
          Acesse cada coleção para consultar e editar os produtos vinculados.
        </p>
      </header>

      {collections.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#0E0E0E] p-12 text-center">
          <Boxes size={32} className="mx-auto mb-3 text-zinc-600" />
          <h2 className="text-sm font-bold uppercase text-white">
            Nenhuma coleção cadastrada
          </h2>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => (
            <article
              key={collection.id}
              className="flex flex-col justify-between gap-5 rounded-2xl border border-white/10 bg-[#0D0D0D] p-5 transition-colors hover:border-[#FF6500]/40"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="rounded-xl bg-[#FF6500]/10 p-2.5 text-[#FF6500]">
                      <Boxes size={19} />
                    </span>
                    <h2 className="truncate text-base font-bold text-white">
                      {collection.name}
                    </h2>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                      collection.isActive
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-zinc-500/10 text-zinc-400'
                    }`}
                  >
                    {collection.isActive ? 'Ativa' : 'Inativa'}
                  </span>
                </div>

                {collection.description && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">
                    {collection.description}
                  </p>
                )}

                <p className="flex items-center gap-2 text-xs text-zinc-400">
                  <Package size={14} className="text-[#FF6500]" />
                  {collection._count.products}{' '}
                  {collection._count.products === 1 ? 'produto' : 'produtos'}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
                <Link
                  href={`/admin/colecoes/${collection.id}`}
                  className="inline-flex items-center gap-2 text-xs font-bold text-[#FF6500] transition-colors hover:text-white"
                >
                  Acessar produtos <ArrowRight size={14} />
                </Link>
                <Link
                  href={`/colecao/${collection.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Ver coleção ${collection.name} na loja`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:text-white"
                >
                  Ver na loja <ExternalLink size={13} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
