import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, Package, Pencil } from 'lucide-react';
import { prisma } from '@/lib/db/prisma';
import { formatPrice } from '@/lib/utils/formatters';

export const dynamic = 'force-dynamic';

export default async function AdminCollectionProductsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const collection = await prisma.collection.findUnique({
    where: { id },
    include: {
      products: {
        orderBy: { position: 'asc' },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              sku: true,
              status: true,
              basePrice: true,
              promotionalPrice: true,
            },
          },
        },
      },
    },
  });

  if (!collection) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-16 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="space-y-2">
          <Link
            href="/admin/colecoes"
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft size={14} /> Todas as coleções
          </Link>
          <h1 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
            {collection.name}
          </h1>
          <p className="text-xs text-zinc-400">
            {collection.products.length}{' '}
            {collection.products.length === 1
              ? 'produto vinculado'
              : 'produtos vinculados'}
          </p>
        </div>
        <Link
          href={`/colecao/${collection.slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          Ver coleção na loja <ExternalLink size={14} />
        </Link>
      </div>

      {collection.products.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#0E0E0E] p-12 text-center">
          <Package size={32} className="mx-auto mb-3 text-zinc-600" />
          <h2 className="text-sm font-bold uppercase text-white">
            Esta coleção ainda não tem produtos
          </h2>
          <p className="mt-2 text-xs text-zinc-400">
            Você pode vincular produtos à coleção ao editar o cadastro do produto.
          </p>
          <Link
            href="/admin/produtos"
            className="mt-5 inline-flex items-center rounded-xl bg-[#FF6500] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#FF7A1A]"
          >
            Acessar produtos
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0D0D0D] shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-[#141414] font-semibold uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="p-4">Produto</th>
                  <th className="p-4">SKU</th>
                  <th className="p-4">Preço</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {collection.products.map(({ product }) => (
                  <tr key={product.id} className="transition-colors hover:bg-white/[0.03]">
                    <td className="p-4">
                      <span className="font-bold text-white">{product.name}</span>
                    </td>
                    <td className="p-4 font-mono text-zinc-400">{product.sku}</td>
                    <td className="p-4">
                      <span className="font-semibold text-white">
                        {formatPrice(product.promotionalPrice ?? product.basePrice)}
                      </span>
                      {product.promotionalPrice !== null && (
                        <span className="ml-2 text-zinc-500 line-through">
                          {formatPrice(product.basePrice)}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                          product.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : product.status === 'DRAFT'
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-zinc-500/10 text-zinc-400'
                        }`}
                      >
                        {product.status === 'ACTIVE'
                          ? 'Ativo'
                          : product.status === 'DRAFT'
                            ? 'Rascunho'
                            : 'Arquivado'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/produto/${product.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Ver ${product.name} na loja`}
                          className="text-zinc-400 transition-colors hover:text-white"
                        >
                          <ExternalLink size={15} />
                        </Link>
                        <Link
                          href={`/admin/produtos/${product.id}/editar`}
                          aria-label={`Editar ${product.name}`}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#FF6500] transition-colors hover:text-white"
                        >
                          <Pencil size={14} /> Editar
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
