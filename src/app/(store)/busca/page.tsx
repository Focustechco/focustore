import React from 'react';
import Link from 'next/link';
import { Search, ChevronRight } from 'lucide-react';
import { CatalogService } from '@/modules/catalog/catalog.service';
import { ProductCard } from '@/components/commerce/product-card';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() || '';

  const products = query ? await CatalogService.getAllProducts({ search: query }) : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <nav className="flex items-center gap-2 text-xs text-muted uppercase tracking-wider">
        <Link href="/" className="hover:text-white">Início</Link>
        <ChevronRight size={14} />
        <span className="text-white font-semibold">Busca</span>
      </nav>

      <div className="border-b border-white/10 pb-6 space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase flex items-center gap-3">
          <Search className="text-focus" size={28} />
          Resultados para &ldquo;{query}&rdquo;
        </h1>
        <p className="text-xs text-muted uppercase tracking-wider font-semibold">
          {products.length} {products.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
        </p>
      </div>

      {products.length === 0 ? (
        <div className="py-20 text-center space-y-3 bg-surface rounded-2xl border border-white/5">
          <h3 className="text-lg font-bold text-white uppercase">Nenhum resultado para sua busca</h3>
          <p className="text-xs text-muted">Tente buscar por camiseta, moletom, garrafa, boné ou chaveiro.</p>
          <Link href="/categoria/todos" className="inline-block pt-2 text-xs font-bold text-focus hover:underline">
            Explorar catálogo completo →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}