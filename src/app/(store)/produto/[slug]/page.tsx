import React from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { CatalogService } from '@/modules/catalog/catalog.service';
import { ProductCard } from '@/components/commerce/product-card';
import { ProductClientView } from './product-client-view';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await CatalogService.getProductBySlug(slug);

  if (!product) {
    return { title: 'Produto não encontrado — Focus Store' };
  }

  return {
    title: `${product.name} — Focus Store Oficial`,
    description: product.shortDescription || product.description.slice(0, 160),
    openGraph: {
      title: `${product.name} | Focus Store`,
      description: product.shortDescription || product.description.slice(0, 160),
      images: product.images[0]?.url ? [{ url: product.images[0].url }] : [],
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = await CatalogService.getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const categoryId = product.categories[0]?.categoryId;
  const relatedProducts = await CatalogService.getRelatedProducts(product.id, categoryId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-16">
      {/* 55% Galeria / 45% Detalhes (Client Interativo) */}
      <ProductClientView product={product} />

      {/* Produtos Relacionados */}
      {relatedProducts.length > 0 && (
        <section className="space-y-6 pt-12 border-t border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight uppercase">
              Quem viu este produto também gostou
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}