import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, Sparkles, ArrowRight, Layers, Flame } from 'lucide-react';
import { CatalogService } from '@/modules/catalog/catalog.service';
import { ProductCard } from '@/components/commerce/product-card';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Coleções Exclusivas | FOCUS STORE®',
  description: 'Descubra as coleções conceituais da FOCUS STORE®, incluindo a nova Coleção Focus Amsterdã e Focus Lab.',
};

export default async function CollectionsPage() {
  const collections = await CatalogService.getCollections();
  const allProducts = await CatalogService.getAllProducts();

  const amsterdaProducts = allProducts.filter((p) =>
    p.collections.some((c) => c.collection.slug === 'focus-amsterda')
  );

  const techProducts = allProducts.filter((p) =>
    p.collections.some((c) => c.collection.slug === 'focus-tech' || c.collection.slug === 'focus-lab')
  );

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12 sm:space-y-16">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-muted uppercase tracking-wider">
        <Link href="/" className="hover:text-white transition-colors">Início</Link>
        <ChevronRight size={14} />
        <span className="text-[#FF6500] font-semibold">Coleções</span>
      </nav>

      {/* Header */}
      <div className="border-b border-white/10 pb-8 space-y-3">
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase">
          Coleções <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-[#FF6500]">FOCUS®</span>
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl leading-relaxed">
          Projetos conceituais e cápsulas exclusivas desenvolvidas com materiais nobres, tecnologia têxtil de ponta e acabamento refinado para quem busca máxima autenticidade.
        </p>
      </div>

      {/* =========================================================
          DESTAQUE PRINCIPAL: COLEÇÃO FOCUS AMSTERDÃ (BANNER HERO)
          ========================================================= */}
      <section className="relative rounded-3xl overflow-hidden border border-[#FF6500]/30 bg-gradient-to-br from-[#1A0C00] via-[#0E0E0E] to-[#080808] p-6 sm:p-10 lg:p-14 shadow-[0_20px_50px_rgba(255,101,0,0.15)]">
        {/* Glow de fundo */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-radial from-[#FF6500]/25 via-transparent to-transparent pointer-events-none blur-3xl" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF6500] text-white text-xs font-black uppercase tracking-widest shadow-md shadow-[#FF6500]/40">
              <Flame size={14} className="fill-white" />
              <span>Nova Coleção • Edição Especial</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight uppercase">
              Coleção Focus <span className="text-[#FF6500]">Amsterdã</span>
            </h2>

            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-xl">
              Inspirada na estética vibrante, urbana e cosmopolita da capital holandesa. Apresenta o icônico <strong className="text-white">Laranja Focus</strong> combinado com o logotipo oficial em <strong className="text-white">branco puro</strong> sobre algodão egípcio e piquet inteligente de alta performance.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/colecao/focus-amsterda"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#FF6500] hover:bg-[#FF7A1A] text-white font-black text-xs uppercase tracking-wider transition-all duration-300 shadow-lg shadow-[#FF6500]/30 hover:scale-105 active:scale-95"
              >
                <span>Ver Coleção Completa</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          {/* Mini Vitrine da Coleção Amsterdã */}
          <div className="lg:col-span-5 grid grid-cols-3 gap-3 sm:gap-4">
            <div className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 bg-[#121212] group">
              <Image
                src="/images/products/camiseta-focus-orange.jpg"
                alt="T-Shirt Focus Amsterdã"
                fill
                sizes="(max-width: 768px) 33vw, 15vw"
                className="object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2 sm:p-2.5">
                <span className="text-[10px] sm:text-xs font-bold text-white leading-tight">T-Shirt</span>
              </div>
            </div>

            <div className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 bg-[#121212] group">
              <Image
                src="/images/products/polo-focus-orange.jpg"
                alt="Polo Focus Amsterdã"
                fill
                sizes="(max-width: 768px) 33vw, 15vw"
                className="object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2 sm:p-2.5">
                <span className="text-[10px] sm:text-xs font-bold text-white leading-tight">Polo</span>
              </div>
            </div>

            <div className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 bg-[#121212] group">
              <Image
                src="/images/products/bone-focus-orange.jpg"
                alt="Boné Focus Amsterdã"
                fill
                sizes="(max-width: 768px) 33vw, 15vw"
                className="object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2 sm:p-2.5">
                <span className="text-[10px] sm:text-xs font-bold text-white leading-tight">Boné</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          PRODUTOS DA COLEÇÃO FOCUS AMSTERDÃ
          ========================================================= */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#FF6500]" />
              Itens Exclusivos • Focus Amsterdã
            </h2>
            <p className="text-xs text-zinc-400 mt-1">Peças avulsas numeradas da coleção cápsula</p>
          </div>
          <Link
            href="/colecao/focus-amsterda"
            className="text-xs font-bold text-[#FF6500] hover:underline flex items-center gap-1 uppercase tracking-wider"
          >
            <span>Ver tudo</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {amsterdaProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* =========================================================
          PRODUTOS DA COLEÇÃO FOCUS TECH (TECHWEAR ESSENTIALS)
          ========================================================= */}
      <section className="space-y-6 pt-6 border-t border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-zinc-400" />
              Coleção Focus Tech • Techwear Essentials
            </h2>
            <p className="text-xs text-zinc-400 mt-1">A essência do design minimalista, preto e branco com máxima performance</p>
          </div>
          <Link
            href="/colecao/focus-tech"
            className="text-xs font-bold text-[#FF6500] hover:underline flex items-center gap-1 uppercase tracking-wider"
          >
            <span>Ver tudo</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {techProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
