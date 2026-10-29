import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { CatalogService } from '@/modules/catalog/catalog.service';
import { HeroCarousel } from '@/components/commerce/hero-carousel';
import { FeaturedProductsCarousel } from '@/components/commerce/featured-products-carousel';
import { MobileProductsCarousel } from '@/components/commerce/mobile-products-carousel';
import { CommunityInstagramGallery } from '@/components/commerce/community-instagram-gallery';
import { FAQAccordion } from '@/components/commerce/faq-accordion';
import { Button } from '@/components/ui/button';
import { Suspense } from "react";

// Mantenha os imports que já existem no arquivo.

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen p-8">
          Carregando produtos...
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}

async function HomePageContent() {
  const [products, heroBanners, featuredBanners, realLifeBanners] = await Promise.all([
    CatalogService.getAllProducts(),
    CatalogService.getBanners('home_hero'),
    CatalogService.getBanners('home_featured'),
    CatalogService.getBanners('home_real_life'),
  ]);

  // Ordenação dos produtos para o carrossel interativo de destaques (com navegação pelas setas)
  const priorityOrder = [
    'copo-termico-focus',
    'bone-focus-signature',
    'caderno-espiral-focus',
    'moletom-focus-hoodie',
    'garrafa-termica-focus',
    'mousepad-focus',
    'suporte-celular-focus',
    'camisa-focus-lab',
    'moletom-focus-lab',
    'bone-focus-lab',
    'suporte-headphone-focus',
    'kit-canetas-focus',
    'caneta-focus-black',
    'stickers-focus',
    'chaveiro-focus',
    'caneca-focus-lab',
    'caderno-focus',
  ];

  const sortedFeaturedProducts = [...products].sort((a, b) => {
    const idxA = priorityOrder.indexOf(a.slug);
    const idxB = priorityOrder.indexOf(b.slug);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });

  // Produtos da Coleção Streetwear & Techwear (Focus Lab)
  const streetwearOrder = [
    'moletom-focus-hoodie',
    'camisa-focus-lab',
    'moletom-focus-lab',
    'bone-focus-lab',
  ];

  const streetwearProducts = streetwearOrder
    .map((slug) => products.find((p) => p.slug === slug))
    .filter(Boolean) as typeof products;

  // Produtos da linha Workspace & Desk Setup
  const workspaceOrder = [
    'copo-termico-focus',
    'suporte-headphone-focus',
    'mousepad-focus',
    'suporte-celular-focus',
  ];

  const workspaceProducts = workspaceOrder
    .map((slug) => products.find((p) => p.slug === slug))
    .filter(Boolean) as typeof products;

  // Fallback para os 3 banners de destaque caso nenhum esteja cadastrado
  const defaultFeaturedBanners = [
    {
      id: 'default-feat-1',
      title: 'KITS E\nPRESENTES',
      subtitle: 'Para quem pensa diferente.',
      ctaText: 'Ver kits',
      ctaLink: '/categoria/kits-e-presentes',
      imageUrl: '/images/banners/kits-presentes-banner.jpg',
    },
    {
      id: 'default-feat-2',
      title: 'PRODUTOS\nEXCLUSIVOS',
      subtitle: 'Design que inspira.',
      ctaText: 'Explorar',
      ctaLink: '/colecao/focus-lab',
      imageUrl: '/images/banners/produtos-exclusivos-banner.png',
    },
    {
      id: 'default-feat-3',
      title: 'FAÇA PARTE\nDO MOVIMENTO',
      subtitle: 'Mais que uma loja, um movimento.',
      ctaText: 'Saiba mais',
      ctaLink: '/colecao/focus-academy',
      imageUrl: '/images/banners/faca-parte-movimento.png',
    },
  ];

  const activeFeaturedBanners =
    featuredBanners && featuredBanners.length > 0 ? featuredBanners : defaultFeaturedBanners;

  return (
    <div className="bg-[#080808] text-white min-h-screen pb-20 space-y-12 sm:space-y-14">
      {/* =========================================================
          1. HERO CAROUSEL AUTO-LOOPING INTERATIVO
          ========================================================= */}
      <HeroCarousel initialBanners={heroBanners} />

      {/* =========================================================
          2. BANNERS EM DESTAQUE (ABAIXO DA HERO)
          ========================================================= */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {activeFeaturedBanners
            .filter(
              (banner) =>
                !banner.title.toLowerCase().replace(/\s+/g, ' ').includes('produtos exclusivos'),
            )
            .slice(0, 2)
            .map((banner) => {
            const lines = banner.title.split('\n');
            const firstLine = lines[0] || '';
            const secondLine = lines.slice(1).join(' ');

            return (
              <Link
                key={banner.id}
                href={banner.ctaLink || '#'}
                className="relative h-52 rounded-2xl overflow-hidden bg-[#0F0F0F] border border-white/10 p-6 sm:p-8 flex flex-col justify-between group hover:border-[#FF6500]/50 transition-all shadow-xl"
              >
                <div className="absolute inset-0 z-10 overflow-hidden">
                  <Image
                    src={banner.imageUrl}
                    alt={banner.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover object-right group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0F0F0F] via-[#0F0F0F]/50 to-transparent z-10" />
                </div>

                <div className="relative z-20 space-y-1 max-w-[210px]">
                  <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight leading-tight">
                    {firstLine}
                    {secondLine && (
                      <>
                        <br />
                        <span className="text-[#FF6500]">{secondLine}</span>
                      </>
                    )}
                  </h3>
                  {banner.subtitle && (
                    <p className="text-xs text-zinc-400 font-medium line-clamp-2">
                      {banner.subtitle}
                    </p>
                  )}
                </div>

                <div className="relative z-20">
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-[11px] font-bold text-white group-hover:bg-[#FF6500] group-hover:border-[#FF6500] transition-all shadow-lg shadow-black/60">
                    {banner.ctaText || 'Ver mais'} <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* =========================================================
          4. PRODUTOS EM DESTAQUE (CARROSSEL INTERATIVO COM SETAS)
          ========================================================= */}
      <FeaturedProductsCarousel products={sortedFeaturedProducts} />

      {/* =========================================================
          6. SEÇÃO COM CARDS DARK (LINHA STREETWEAR & TECHWEAR)
          ========================================================= */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-end justify-between border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-bold text-[#FF6500] uppercase tracking-widest mb-1">Coleção Focus Tech</p>
            <h2 className="text-2xl font-black text-white tracking-tight uppercase">
              Linha Streetwear & Techwear
            </h2>
          </div>
          <Link
            href="/categoria/vestuario"
            className="hidden sm:flex text-xs font-bold text-zinc-400 hover:text-white uppercase tracking-wider items-center gap-1.5 transition-colors"
          >
            Ver Coleção Completa <ArrowRight size={14} />
          </Link>
        </div>

        <MobileProductsCarousel
          products={streetwearProducts}
          collectionHref="/categoria/vestuario"
          collectionLabel="Ver Coleção Completa"
        />
      </section>

      {/* =========================================================
          6.1 SEÇÃO WORKSPACE & TECH ACCESSORIES
          ========================================================= */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-end justify-between border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-bold text-[#FF6500] uppercase tracking-widest mb-1">Engenharia & Setup</p>
            <h2 className="text-2xl font-black text-white tracking-tight uppercase">
              Workspace & Tech Essentials
            </h2>
          </div>
          <Link
            href="/categoria/tecnologia"
            className="hidden sm:flex text-xs font-bold text-zinc-400 hover:text-white uppercase tracking-wider items-center gap-1.5 transition-colors"
          >
            Ver Linha Tech <ArrowRight size={14} />
          </Link>
        </div>

        <MobileProductsCarousel
          products={workspaceProducts}
          collectionHref="/categoria/tecnologia"
          collectionLabel="Ver Linha Tech"
        />
      </section>

      {/* =========================================================
          7. SEÇÃO NEWSLETTER COMUNIDADE FOCUS
          ========================================================= */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#1C1C1C] via-[#121212] to-[#0A0A0A] p-8 sm:p-14 border border-white/10 text-center space-y-6">
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase max-w-2xl mx-auto leading-tight">
            JUNTE-SE À COMUNIDADE DOS CRIADORES
          </h2>

          <p className="text-zinc-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed font-normal">
            Receba lançamentos antecipados de drops limitados, cupons de até 20% e novidades exclusivas de design e tecnologia.
          </p>

          <form className="max-w-md mx-auto flex flex-col sm:flex-row gap-3 pt-2">
            <input
              type="email"
              placeholder="Digite seu melhor e-mail"
              className="flex-1 bg-[#101010] border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF6500]"
            />
            <Button size="md" className="bg-[#FF6500] hover:bg-[#FF7A1A] whitespace-nowrap font-bold">
              Quero Participar
            </Button>
          </form>
        </div>
      </section>

      {/* =========================================================
          8. SEÇÃO FOCUS IN REAL LIFE (INSTAGRAM DA COMUNIDADE)
          ========================================================= */}
      <CommunityInstagramGallery banners={realLifeBanners} />

      {/* =========================================================
          9. SEÇÃO PERGUNTAS FREQUENTES (FAQ ACCORDION)
          ========================================================= */}
      <FAQAccordion />
    </div>
  );
}
