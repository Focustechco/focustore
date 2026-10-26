'use client';

import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ProductCard } from './product-card';

type Product = ComponentProps<typeof ProductCard>['product'];

export function MobileProductsCarousel({
  products,
  collectionHref,
  collectionLabel,
}: {
  products: Product[];
  collectionHref: string;
  collectionLabel: string;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);

  const updateActiveSlide = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const containerLeft = container.getBoundingClientRect().left;
    let closestIndex = 0;
    let closestDistance = Infinity;

    slideRefs.current.forEach((slide, index) => {
      if (!slide) return;

      const distance = Math.abs(slide.getBoundingClientRect().left - containerLeft);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    activeIndexRef.current = closestIndex;
    setActiveIndex(closestIndex);
  };

  const goToSlide = useCallback((index: number) => {
    const container = scrollContainerRef.current;
    const slide = slideRefs.current[index];
    if (!container || !slide) return;

    const left =
      slide.getBoundingClientRect().left -
      container.getBoundingClientRect().left +
      container.scrollLeft;

    container.scrollTo({ left, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (products.length < 2) return;

    const mobileQuery = window.matchMedia('(max-width: 639px)');
    let intervalId: number | undefined;

    const startAutoplay = () => {
      if (!mobileQuery.matches || intervalId !== undefined) return;

      intervalId = window.setInterval(() => {
        const nextIndex = (activeIndexRef.current + 1) % products.length;
        activeIndexRef.current = nextIndex;
        setActiveIndex(nextIndex);
        goToSlide(nextIndex);
      }, 4000);
    };

    const stopAutoplay = () => {
      if (intervalId === undefined) return;

      window.clearInterval(intervalId);
      intervalId = undefined;
    };

    const updateAutoplay = () => {
      if (mobileQuery.matches) startAutoplay();
      else stopAutoplay();
    };

    updateAutoplay();
    mobileQuery.addEventListener('change', updateAutoplay);

    return () => {
      mobileQuery.removeEventListener('change', updateAutoplay);
      stopAutoplay();
    };
  }, [goToSlide, products.length]);

  return (
    <>
      <div
        ref={scrollContainerRef}
        onScroll={updateActiveSlide}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-1 scrollbar-none sm:hidden"
      >
        {products.map((product, index) => (
          <div
            key={product.id}
            ref={(element) => {
              slideRefs.current[index] = element;
            }}
            className="w-full shrink-0 snap-start"
          >
            <ProductCard product={product} variant="dark" />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1 sm:hidden">
        {products.length > 1 ? (
          <div className="flex items-center gap-2" aria-label="Navegação dos produtos">
            {products.map((product, index) => (
              <button
                key={product.id}
                type="button"
                onClick={() => goToSlide(index)}
                className={`h-1.5 cursor-pointer rounded-full transition-all duration-300 ${
                  index === activeIndex
                    ? 'w-6 bg-[#FF6500]'
                    : 'w-1.5 bg-white/30 hover:bg-white/60'
                }`}
                aria-label={`Mostrar ${product.name}`}
                aria-current={index === activeIndex ? 'true' : undefined}
              />
            ))}
          </div>
        ) : (
          <span />
        )}
        <Link
          href={collectionHref}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 transition-colors hover:text-white"
        >
          {collectionLabel} <ArrowRight size={12} />
        </Link>
      </div>

      <div className="hidden grid-cols-1 gap-6 sm:grid sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => (
          <div key={product.id} className="h-full">
            <ProductCard product={product} variant="dark" />
          </div>
        ))}
      </div>
    </>
  );
}
