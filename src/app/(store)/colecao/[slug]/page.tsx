import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ChevronRight, Sparkles, Flame, ShieldCheck, ArrowRight, Truck } from 'lucide-react';
import { CatalogService } from '@/modules/catalog/catalog.service';
import { ProductCard } from '@/components/commerce/product-card';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const collection = await CatalogService.getCollectionBySlug(slug);

  if (!collection) {
    return { title: 'Coleção | FOCUS STORE®' };
  }

  const collectionName = slug === 'focus-amsterda'
    ? 'Focus Linguagens de Programação'
    : collection.name;
  const collectionDescription = slug === 'focus-amsterda'
    ? 'Linha exclusiva inspirada no universo da programação, com Laranja Focus e logotipo oficial em branco puro.'
    : collection.description || collection.headline;

  return {
    title: `Coleção ${collectionName} | FOCUS STORE®`,
    description: collectionDescription,
  };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const collection = await CatalogService.getCollectionBySlug(slug);
  const allProducts = await CatalogService.getAllProducts();

  const collectionProducts = allProducts.filter((p) =>
    p.collections.some((c) => c.collection.slug === slug)
  );

  const isAmsterda = slug === 'focus-amsterda';
  const collectionName = isAmsterda
    ? 'Focus Linguagens de Programação'
    : collection?.name || slug.replace('-', ' ');
  const collectionDescription = isAmsterda
    ? 'Linha exclusiva inspirada no universo da programação, com Laranja Focus e logotipo oficial em branco puro.'
    : collection?.description ||
      'Peças exclusivas projetadas com materiais nobres, tecnologia têxtil de ponta e estética minimalista techwear.';

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 sm:space-y-12">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-muted uppercase tracking-wider">
        <Link href="/" className="hover:text-white transition-colors">Início</Link>
        <ChevronRight size={14} />
        <Link href="/colecoes" className="hover:text-white transition-colors">Coleções</Link>
        <ChevronRight size={14} />
        <span className="text-[#FF6500] font-semibold">{collection?.name || slug}</span>
      </nav>

      {/* Banner Especial da Coleção */}
      <div className={`relative rounded-3xl overflow-hidden border p-6 sm:p-10 lg:p-12 ${
        isAmsterda
          ? 'border-[#FF6500]/40 bg-gradient-to-br from-[#200F00] via-[#0F0F0F] to-[#080808] shadow-[0_20px_60px_rgba(255,101,0,0.18)]'
          : 'border-white/10 bg-gradient-to-br from-[#141414] to-[#0A0A0A]'
      }`}>
        {isAmsterda && (
          <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-radial from-[#FF6500]/25 via-transparent to-transparent pointer-events-none blur-3xl" />
        )}

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF6500]/15 border border-[#FF6500]/30 text-[#FF6500] text-xs font-bold uppercase tracking-wider">
            {isAmsterda ? <Flame size={14} /> : <Sparkles size={14} />}
            <span>{isAmsterda ? 'Cápsula Especial • Laranja Focus' : 'Linha Exclusiva Focus'}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
            Coleção {collectionName}
          </h1>

          <p className="text-sm sm:text-base text-zinc-300 leading-relaxed">
            {collectionDescription}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-2">
            <span className="flex items-center gap-1.5 text-white font-medium">
              <ShieldCheck size={16} className="text-[#FF6500]" /> Edição Limitada
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-white font-medium">
              <Truck size={16} className="text-[#FF6500]" /> Pronta Entrega
            </span>
            <span>•</span>
            <span className="text-zinc-400">{collectionProducts.length} produtos exclusivos</span>
          </div>
        </div>
      </div>

      {/* Grid de Produtos */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-lg sm:text-xl font-bold text-white uppercase tracking-wider">
            Produtos da Coleção ({collectionProducts.length})
          </h2>
          <span className="text-xs text-zinc-400">Exibindo todos os itens</span>
        </div>

        {collectionProducts.length === 0 ? (
          <div className="py-20 text-center space-y-4 bg-[#0F0F0F] rounded-2xl border border-white/5">
            <p className="text-zinc-400 text-sm">Nenhum produto cadastrado nesta coleção no momento.</p>
            <Link
              href="/colecoes"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#FF6500] text-white text-xs font-bold uppercase tracking-wider"
            >
              Ver outras coleções
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {collectionProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}