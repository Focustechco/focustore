'use client';

import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductCard } from './product-card';

interface FeaturedProductsCarouselProps {
  products: any[];
}

export function FeaturedProductsCarousel({ products }: FeaturedProductsCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    const ref = scrollContainerRef.current;
    if (ref) {
      ref.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        ref.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [products]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      // Scrolla aproximadamente 2 a 3 cards por clique
      const scrollAmount = container.clientWidth * 0.75;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-4 select-none">
      {/* Header da Seção com Título, Subtítulo e Setas de Navegação Funcionais */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Produtos em destaque
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Seleção especial para quem vive tecnologia, criatividade e inovação.
          </p>
        </div>

        {/* Setas Interativas */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className={`w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-[#141414] border transition-all flex items-center justify-center shadow-md focus:outline-none ${
              canScrollLeft
                ? 'border-white/10 hover:border-[#FF6500] hover:text-[#FF6500] text-zinc-300 hover:scale-105 active:scale-95 cursor-pointer'
                : 'border-white/5 text-zinc-600 cursor-not-allowed opacity-50'
            }`}
            aria-label="Anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className={`w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-[#141414] border transition-all flex items-center justify-center shadow-md focus:outline-none ${
              canScrollRight
                ? 'border-white/10 hover:border-[#FF6500] hover:text-[#FF6500] text-zinc-300 hover:scale-105 active:scale-95 cursor-pointer'
                : 'border-white/5 text-zinc-600 cursor-not-allowed opacity-50'
            }`}
            aria-label="Próximo"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Carrossel Horizontal Fluido dos Produtos */}
      <div
        ref={scrollContainerRef}
        className="flex gap-3.5 sm:gap-4 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory items-stretch scroll-smooth"
      >
        {products.map((product) => (
          <div
            key={product.id}
            className="flex-shrink-0 w-[calc(50%-7px)] sm:w-[calc(33.333%-11px)] md:w-[calc(25%-12px)] lg:w-[calc(16.666%-13.5px)] snap-start flex flex-col h-full"
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
