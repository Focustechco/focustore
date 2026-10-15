import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { CatalogService } from '@/modules/catalog/catalog.service';
import { ProductCard } from '@/components/commerce/product-card';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; min?: string; max?: string }>;
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { sort, min, max } = await searchParams;

  const category = slug !== 'todos' ? await CatalogService.getCategoryBySlug(slug) : null;
  const products = await CatalogService.getAllProducts({
    categorySlug: slug,
    sortBy: (sort as any) || 'relevance',
    minPrice: min ? Number(min) : undefined,
    maxPrice: max ? Number(max) : undefined,
  });

  const title = slug === 'todos' ? 'Todos os Produtos' : category?.name || slug;
  const description = category?.description || 'Explore a linha completa de tecnologia, streetwear e design.';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-muted uppercase tracking-wider">
        <Link href="/" className="hover:text-white">Início</Link>
        <ChevronRight size={14} />
        <Link href="/categoria/todos" className="hover:text-white">Categorias</Link>
        <ChevronRight size={14} />
        <span className="text-white font-semibold">{title}</span>
      </nav>

      {/* Header da Categoria */}
      <div className="border-b border-white/10 pb-6 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase">
            {title}
          </h1>
          <span className="text-xs text-muted font-semibold uppercase tracking-wider">
            {products.length} {products.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
          </span>
        </div>
        <p className="text-sm text-muted max-w-2xl">{description}</p>
      </div>

      {/* Filtros e Grid */}
      <div className="space-y-6">
        {products.length === 0 ? (
          <div className="py-20 text-center space-y-3 bg-surface rounded-2xl border border-white/5">
            <h3 className="text-lg font-bold text-white uppercase">Nenhum produto encontrado</h3>
            <p className="text-xs text-muted">Tente ajustar seus filtros ou explore outras categorias.</p>
            <Link href="/categoria/todos" className="inline-block pt-2 text-xs font-bold text-focus hover:underline">
              Ver todos os produtos →
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
    </div>
  );
}