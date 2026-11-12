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
import { FeaturedBannerTitle } from '@/components/commerce/featured-banner-title';
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
  const [
    productsResult,
    heroBannersResult,
    featuredBannersResult,
    realLifeBannersResult,
    collectionBannerResult,
  ] =
    await Promise.allSettled([
    CatalogService.getAllProducts(),
    CatalogService.getBanners('home_hero'),
    CatalogService.getBanners('home_featured'),
    CatalogService.getBanners('home_real_life'),
    CatalogService.getBanners('home_collection'),
  ]);
  const products = productsResult.status === 'fulfilled' ? productsResult.value : [];
  const heroBanners = heroBannersResult.status === 'fulfilled' ? heroBannersResult.value : [];
  const featuredBanners = featuredBannersResult.status === 'fulfilled' ? featuredBannersResult.value : [];
  const realLifeBanners = realLifeBannersResult.status === 'fulfilled' ? realLifeBannersResult.value : [];
  const collectionBanner =
    collectionBannerResult.status === 'fulfilled' ? collectionBannerResult.value[0] : undefined;

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

  // Fallback para os 3 banners de destaque caso nenhum esteja cadastrado
  const defaultFeaturedBanners = [
    {
      id: 'default-feat-1',
      title: 'KITS E\nPRESENTES',
      subtitle: 'Para quem pensa diferente.',
      ctaText: 'Ver kits',
      ctaLink: '/categoria/kits-e-presentes',
      imageUrl: '/images/banners/kits-presentes-banner.png',
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

  const categoryCards = [
    {
      title: 'Camisetas',
      href: '/categoria/vestuario',
      productSlug: 'camisa-focus-lab',
      fallbackImage: '/images/products/Camiseta-focus.png',
    },
    {
      title: 'Moletons',
      href: '/categoria/vestuario',
      productSlug: 'moletom-focus-hoodie',
      fallbackImage: '/images/products/Moletom-preto.png',
    },
    {
      title: 'Bonés',
      href: '/categoria/acessorios',
      productSlug: 'bone-focus-signature',
      fallbackImage: '/images/products/bone-focus-signature.png',
    },
    {
      title: 'Acessórios',
      href: '/categoria/acessorios',
      productSlug: 'garrafa-termica-focus',
      fallbackImage: '/images/products/garrafa-focus.png',
    },
  ];

  return (
    <div className="min-h-screen space-y-12 bg-[#080808] pb-16 text-white sm:space-y-16 sm:pb-20">
      <HeroCarousel initialBanners={heroBanners} />

      <section className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
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
            const isMovementBanner =
              lines.join(' ').replace(/\s+/g, ' ').trim().toUpperCase() ===
              'FAÇA PARTE DO MOVIMENTO';

            return (
              <Link
                key={banner.id}
                href={banner.ctaLink || '#'}
                className="group relative flex h-44 flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-[#0F0F0F] p-5 transition-colors hover:border-white/25 sm:h-52 sm:rounded-2xl sm:p-7"
              >
                <div className="absolute inset-0 z-10 overflow-hidden">
                  <Image
                    src={banner.imageUrl}
                    alt={banner.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover object-[right_58%] transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 z-10 bg-gradient-to-r from-[#080808]/95 via-[#080808]/55 to-transparent" />
                </div>

                <div className="relative z-20 max-w-[280px] space-y-1">
                  {isMovementBanner ? (
                    <FeaturedBannerTitle firstLine="FAÇA PARTE" secondLine="DO MOVIMENTO" />
                  ) : (
                    <h3 className="font-banner-display text-xl uppercase text-white sm:text-2xl">
                      {firstLine}
                      {secondLine && (
                        <>
                          <br />
                          <span className="text-[#FF6500]">{secondLine}</span>
                        </>
                      )}
                    </h3>
                  )}
                  {banner.subtitle && (
                    <p className="text-xs text-zinc-400 font-medium line-clamp-2">
                      {banner.subtitle}
                    </p>
                  )}
                </div>

                <div className="relative z-20">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-black/60 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wide text-white transition-colors group-hover:border-[#FF6500] group-hover:bg-[#FF6500]">
                    {banner.ctaText || 'Ver mais'} <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section
        aria-labelledby="home-categories-heading"
        className="mx-auto w-full max-w-[1440px] space-y-5 px-4 sm:px-6 lg:px-8"
      >
        <div className="flex items-end justify-between">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6500]">
              Explore a Focus
            </p>
            <h2 id="home-categories-heading" className="text-xl font-bold uppercase tracking-tight sm:text-2xl">
              Categorias em destaque
            </h2>
          </div>
          <Link
            href="/categoria/todos"
            className="hidden items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 transition-colors hover:text-white sm:inline-flex"
          >
            Ver tudo <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {categoryCards.map((category) => {
            const imageUrl =
              products.find((product) => product.slug === category.productSlug)?.images[0]?.url ||
              category.fallbackImage;

            return (
              <Link
                key={category.title}
                href={category.href}
                className="group relative aspect-[1.45] overflow-hidden rounded-xl border border-white/10 bg-[#111] sm:aspect-[1.25] sm:rounded-2xl"
              >
                <Image
                  src={imageUrl}
                  alt={category.title}
                  fill
                  sizes="(max-width: 639px) 50vw, (max-width: 1023px) 25vw, 320px"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3 sm:p-5">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-white sm:text-base">
                    {category.title}
                  </h3>
                  <ArrowRight
                    size={16}
                    className="translate-x-0 text-white/80 transition-all group-hover:translate-x-1 group-hover:text-[#FF6500]"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <FeaturedProductsCarousel products={sortedFeaturedProducts} />

      <section className="mx-auto w-full max-w-[1440px] space-y-6 px-4 sm:px-6 lg:px-8">
        <Link
          href={collectionBanner?.ctaLink || '/colecao/focus-lab'}
          className="group relative isolate flex min-h-[250px] items-end overflow-hidden rounded-xl border border-white/10 bg-[#101010] p-6 sm:min-h-[330px] sm:items-center sm:p-10 lg:p-14"
        >
          <Image
            src={collectionBanner?.imageUrl || '/images/hero/hero-collection-banner.webp'}
            alt={collectionBanner?.title || 'Peças da coleção Focus Lab'}
            fill
            sizes="(max-width: 768px) 100vw, 1440px"
            className="absolute inset-0 -z-20 object-cover object-[65%_center] transition-transform duration-700 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/95 via-black/70 to-black/5" />
          <div className="max-w-md space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FF6500] sm:text-xs">
              {collectionBanner?.subtitle || 'Coleção em destaque'}
            </p>
            <h2 className="font-banner-brigends text-4xl uppercase text-white sm:text-6xl">
              {collectionBanner?.title || 'Focus Lab'}
            </h2>
            <span className="inline-flex items-center gap-2 rounded-md bg-[#FF6500] px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-white transition-colors group-hover:bg-[#ff7a1a]">
              {collectionBanner?.ctaText || 'Conheça a coleção'} <ArrowRight size={14} />
            </span>
          </div>
        </Link>

        {streetwearProducts.length > 0 && (
          <div className="space-y-5">
            <div className="flex items-end justify-between border-b border-white/10 pb-3">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6500]">
                  Focus Lab
                </p>
                <h3 className="text-xl font-bold uppercase tracking-tight text-white sm:text-2xl">
                  Peças da coleção
                </h3>
              </div>
              <Link
                href="/colecao/focus-lab"
                className="hidden items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 transition-colors hover:text-white sm:inline-flex"
              >
                Ver coleção <ArrowRight size={14} />
              </Link>
            </div>
            <MobileProductsCarousel
              products={streetwearProducts}
              collectionHref="/colecao/focus-lab"
              collectionLabel="Ver coleção"
            />
          </div>
        )}
      </section>

      <CommunityInstagramGallery banners={realLifeBanners} />

      <section className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-white/10 bg-[#0D0D0D] p-6 sm:rounded-2xl sm:p-10">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF6500]">
              Novidades Focus
            </p>
            <h2 className="text-2xl font-extrabold uppercase tracking-tight text-white sm:text-3xl">
              JUNTE-SE À COMUNIDADE DOS CRIADORES
            </h2>
            <p className="text-sm leading-relaxed text-zinc-400">
              Receba lançamentos antecipados de drops limitados, cupons de até 20% e novidades exclusivas de design e tecnologia.
            </p>
            <form className="mx-auto flex max-w-lg flex-col gap-2 pt-2 sm:flex-row">
              <input
                type="email"
                placeholder="Digite seu melhor e-mail"
                className="min-h-11 min-w-0 flex-1 rounded-md border border-white/15 bg-black px-4 text-sm text-white placeholder:text-zinc-500 focus:border-[#FF6500] focus:outline-none"
              />
              <Button size="md" className="min-h-11 whitespace-nowrap rounded-md bg-[#FF6500] font-bold hover:bg-[#FF7A1A]">
                Quero Participar
              </Button>
            </form>
          </div>
        </div>
      </section>

      <FAQAccordion />
    </div>
  );
}
