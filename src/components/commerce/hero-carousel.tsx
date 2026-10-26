'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

export interface HeroBanner {
  id: string;
  title: string;
  subtitle?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  imageUrl: string;
}

const DEFAULT_SLIDES = [
  {
    id: 'slide-1',
    tagline: 'DROP OFICIAL 2026 // STREETWEAR & TECHWEAR',
    titleLine1: 'IDEIAS TAMBÉM',
    titleLine2: 'SE USAM.',
    subtitle: 'Linha exclusiva desenvolvida para quem vive tecnologia, criatividade e inovação. Tecidos de alta gramatura e corte moderno.',
    primaryButtonText: 'Ver coleção',
    primaryButtonHref: '/categoria/vestuario',
    secondaryButtonText: 'Focus Tech',
    secondaryButtonHref: '/colecao/focus-tech',
    imageUrl: '/images/hero/hero-models-banner.png',
    imageAlt: 'Linha Streetwear Focus Store',
  },
  {
    id: 'slide-2',
    tagline: 'TECH CULTURE // BUILD & SHIP',
    titleLine1: 'FEITO POR DEVS,',
    titleLine2: 'PARA DEVS.',
    subtitle: 'Peças criadas para sua rotina de código, café e alto desempenho. Canecas térmicas, cadernos e vestuário premium.',
    primaryButtonText: 'Explorar Linha',
    primaryButtonHref: '/categoria/todos',
    secondaryButtonText: 'Ver Acessórios',
    secondaryButtonHref: '/categoria/acessorios',
    imageUrl: '/images/hero/hero-tech-office.jpg',
    imageAlt: 'Tech Culture Focus Store',
  },
  {
    id: 'slide-3',
    tagline: 'FOCUS STREETWEAR // LINHA ESSENCIAL',
    titleLine1: 'FAÇA PARTE DO',
    titleLine2: 'MOVIMENTO.',
    subtitle: 'Camisas, moletons e polos exclusivas para quem respira tecnologia. Garanta suas peças com 10% OFF no PIX pelo cupom FOCUS10.',
    primaryButtonText: 'Ver Coleção',
    primaryButtonHref: '/categoria/vestuario',
    secondaryButtonText: 'Focus Tech',
    secondaryButtonHref: '/colecao/focus-tech',
    imageUrl: '/images/hero/hero-movimento-streetwear.png',
    imageAlt: 'Trio Streetwear Focus - Faça Parte do Movimento',
  },
];

const AUTOPLAY_INTERVAL = 4000;

export function HeroCarousel({ initialBanners }: { initialBanners?: HeroBanner[] }) {
  const slides = (initialBanners && initialBanners.length > 0)
    ? initialBanners.map((b, idx) => {
        const titleLines = b.title.split('\n');
        return {
          id: b.id,
          tagline: `FOCUS EXCLUSIVE // DROP 2026`,
          titleLine1: titleLines[0] || b.title,
          titleLine2: titleLines[1] || '',
          subtitle: b.subtitle || 'Linha exclusiva desenvolvida para quem vive tecnologia e inovação.',
          primaryButtonText: b.ctaText || 'Ver Coleção',
          primaryButtonHref: b.ctaLink || '/categoria/vestuario',
          secondaryButtonText: 'Focus Tech',
          secondaryButtonHref: '/colecao/focus-tech',
          imageUrl: b.imageUrl,
          imageAlt: b.title,
        };
      })
    : DEFAULT_SLIDES;

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPaused) return;

    timerRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, AUTOPLAY_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, slides.length, currentSlide]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;

    if (diff > 50) nextSlide();
    else if (diff < -50) prevSlide();
    setTouchStartX(null);
  };

  const slide = slides[currentSlide] || slides[0];

  return (
    <section className="max-w-[1440px] mx-auto mt-6 px-4 sm:px-6 lg:px-8 select-none sm:mt-8">
      <div
        className="relative aspect-[1.55] min-h-0 sm:aspect-auto sm:min-h-[420px] lg:min-h-[460px] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#0A0A0A] border border-white/10 hover:border-[#FF6500]/30 transition-all duration-500 shadow-2xl flex flex-col justify-between p-0 sm:p-10 lg:p-12 group"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* 1. Imagem de Fundo em Alta Resolução */}
        <div className="absolute inset-x-0 top-0 bottom-[68px] z-0 sm:inset-0">
          <Image
            key={slide.imageUrl}
            src={slide.imageUrl}
            alt={slide.imageAlt}
            fill
            sizes="(max-width: 1440px) 100vw, 1440px"
            className="object-cover object-center sm:object-right md:object-center group-hover:scale-103 transition-transform duration-700 ease-out"
            priority
          />
          {/* Gradientes: no mobile protege o topo e a base; no desktop gradiente clássico da esquerda para direita */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/75 via-45% to-transparent sm:bg-gradient-to-r sm:from-[#080808] sm:via-[#080808]/85 sm:via-45% sm:to-transparent z-10" />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#080808]/80 to-transparent sm:hidden z-10" />
        </div>

        {/* 2. Conteúdo Editorial (No Desktop: layout padrão centralizado na vertical à esquerda; No Mobile: ancorado no rodapé) */}
        <div className="absolute left-5 right-5 bottom-[82px] z-20 max-w-xl space-y-1 sm:relative sm:left-auto sm:right-auto sm:bottom-auto sm:space-y-3.5 sm:mt-auto sm:my-auto">
          <h1 className="line-clamp-2 text-base sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.1] sm:leading-[1.05] uppercase drop-shadow-md">
            {slide.titleLine1}
            {slide.titleLine2 && (
              <>
                <br className="hidden xs:inline sm:inline" />{' '}
                <span className="text-[#FF6500]">{slide.titleLine2}</span>
              </>
            )}
          </h1>

          <p className="text-zinc-300 text-[10px] sm:text-sm lg:text-base leading-snug sm:leading-relaxed max-w-sm sm:max-w-md font-normal drop-shadow-sm line-clamp-2 sm:line-clamp-none">
            {slide.subtitle}
          </p>

          <div className="hidden sm:flex pt-1 sm:pt-2 flex-wrap items-center gap-2 sm:gap-3">
            <Link href={slide.primaryButtonHref}>
              <button className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-[#FF6500] hover:bg-[#FF7A1A] text-white text-[11px] sm:text-sm font-bold uppercase tracking-wider transition-all inline-flex items-center gap-1.5 sm:gap-2 shadow-xl shadow-[#FF6500]/30 hover:scale-[1.02] active:scale-95">
                {slide.primaryButtonText} <ArrowRight size={14} className="sm:w-4 sm:h-4" />
              </button>
            </Link>
            {slide.secondaryButtonText && (
              <Link href={slide.secondaryButtonHref}>
                <button className="px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-black/60 backdrop-blur-md border border-white/20 hover:border-white/40 text-white text-[11px] sm:text-sm font-semibold uppercase tracking-wider transition-all hover:bg-black/80 active:scale-95">
                  {slide.secondaryButtonText}
                </button>
              </Link>
            )}
          </div>
        </div>

        {/* 4. Indicadores de Paginação (Discretos na base) */}
        {slides.length > 1 && (
          <div className="absolute inset-x-0 bottom-0 z-20 flex h-[68px] items-center justify-start gap-2 px-5 sm:relative sm:inset-auto sm:h-auto sm:justify-start sm:px-0 sm:pt-4 sm:gap-2">
            {slides.map((s, idx) => (
              <button
                key={s.id || idx}
                onClick={() => setCurrentSlide(idx)}
                className={`cursor-pointer transition-all duration-300 rounded-full ${
                  idx === currentSlide
                    ? 'w-6 sm:w-8 h-1 sm:h-1.5 bg-[#FF6500]'
                    : 'w-1.5 sm:w-2 h-1 sm:h-1.5 bg-white/30 hover:bg-white/60'
                }`}
                aria-label={`Ir para slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-[18px] z-30 flex items-center justify-end gap-1.5 pr-5 sm:hidden">
          <Link href={slide.primaryButtonHref}>
            <button className="whitespace-nowrap px-3 py-2 rounded-lg bg-[#FF6500] hover:bg-[#FF7A1A] text-white text-[10px] font-bold uppercase tracking-wide transition-all inline-flex items-center gap-1 shadow-xl shadow-[#FF6500]/30 hover:scale-[1.02] active:scale-95">
              {slide.primaryButtonText} <ArrowRight size={12} />
            </button>
          </Link>
          {slide.secondaryButtonText && (
            <Link href={slide.secondaryButtonHref}>
              <button className="whitespace-nowrap px-3 py-2 rounded-lg bg-black/60 backdrop-blur-md border border-white/20 hover:border-white/40 text-white text-[10px] font-semibold uppercase tracking-wide transition-all hover:bg-black/80 active:scale-95">
                {slide.secondaryButtonText}
              </button>
            </Link>
          )}
        </div>

      </div>
    </section>
  );
}