'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

function InstagramIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

interface CommunityPost {
  id: string;
  handle: string;
  imageUrl: string;
  productName: string;
  instagramUrl: string;
}

const COMMUNITY_POSTS: CommunityPost[] = [
  {
    id: 'post-real-1',
    handle: '@team.focus',
    imageUrl: '/images/community/real-team-duo.jpg',
    productName: 'Camisa Focus Classic Black',
    instagramUrl: 'https://instagram.com/focus.store',
  },
  {
    id: 'post-real-2',
    handle: '@focus.techcrew',
    imageUrl: '/images/community/real-team-booth.jpg',
    productName: 'Camisa Focus Oficial & Drop Summit',
    instagramUrl: 'https://instagram.com/focus.store',
  },
  {
    id: 'post-real-3',
    handle: '@raul.tech',
    imageUrl: '/images/community/real-event-attendee.jpg',
    productName: 'Camisa Focus Oficial Tech Summit',
    instagramUrl: 'https://instagram.com/focus.store',
  },
  {
    id: 'post-real-4',
    handle: '@felipe.creator',
    imageUrl: '/images/community/real-event-tripod.jpg',
    productName: 'Camisa Focus Classic Black',
    instagramUrl: 'https://instagram.com/focus.store',
  },
  {
    id: 'post-real-5',
    handle: '@joao.dev',
    imageUrl: '/images/community/real-office-desk.jpg',
    productName: 'Camisa Focus & Caderno Focus',
    instagramUrl: 'https://instagram.com/focus.store',
  },
  {
    id: 'post-6',
    handle: '@lucas.dev',
    imageUrl: '/images/community/post-hoodie-cafe.jpg',
    productName: 'Moletom Focus Streetwear',
    instagramUrl: 'https://instagram.com/focus.store',
  },
  {
    id: 'post-7',
    handle: '@tech.mariana',
    imageUrl: '/images/community/post-tee-workspace.jpg',
    productName: 'Camisa Focus Classic Black',
    instagramUrl: 'https://instagram.com/focus.store',
  },
  {
    id: 'post-8',
    handle: '@yuki.code',
    imageUrl: '/images/community/post-cap-street.jpg',
    productName: 'Boné Focus Lab Structured',
    instagramUrl: 'https://instagram.com/focus.store',
  },
  {
    id: 'post-9',
    handle: '@gabriela.design',
    imageUrl: '/images/community/post-sweatshirt-loft.jpg',
    productName: 'Sweatshirt Focus Lab Arch',
    instagramUrl: 'https://instagram.com/focus.store',
  },
  {
    id: 'post-10',
    handle: '@pedro.founder',
    imageUrl: '/images/community/post-polo-rooftop.jpg',
    productName: 'Polo Focus Tech & Copo Térmico',
    instagramUrl: 'https://instagram.com/focus.store',
  },
];

export function CommunityInstagramGallery({ banners }: { banners?: any[] }) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const posts =
    banners && banners.length > 0
      ? banners.map((b) => ({
          id: b.id,
          handle: b.title || '@focus.store',
          imageUrl: b.imageUrl,
          productName: b.subtitle || 'Focus Techwear & Lifestyle',
          instagramUrl: b.ctaLink || 'https://instagram.com/focus.store',
        }))
      : COMMUNITY_POSTS;

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6 select-none">
      {/* Header Centralizado no estilo INSIDER IN REAL LIFE */}
      <div className="flex items-end justify-between border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#FF6500] uppercase tracking-widest mb-1">
            <InstagramIcon size={14} className="text-[#FF6500]" />
            <span>@focus.store</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
            FOCUS IN REAL LIFE
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Veja como nossa comunidade veste e usa Focus no dia a dia. Marque <span className="text-white font-semibold">@focus.store</span> para aparecer aqui.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => scroll('left')}
            className="w-9 h-9 rounded-full bg-[#141414] border border-white/10 hover:border-[#FF6500] hover:text-[#FF6500] text-zinc-400 flex items-center justify-center transition-all shadow-md focus:outline-none"
            aria-label="Rolar para esquerda"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-9 h-9 rounded-full bg-[#141414] border border-white/10 hover:border-[#FF6500] hover:text-[#FF6500] text-zinc-400 flex items-center justify-center transition-all shadow-md focus:outline-none"
            aria-label="Rolar para direita"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Grid / Carrossel Horizontal Fluido */}
      <div
        ref={scrollContainerRef}
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory"
      >
        {posts.map((post) => (
          <a
            key={post.id}
            href={post.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex-shrink-0 w-56 sm:w-64 aspect-square rounded-2xl overflow-hidden bg-[#121212] border border-white/10 hover:border-[#FF6500]/50 transition-all duration-300 shadow-xl snap-start block"
          >
            {/* Foto do Post */}
            <Image
              src={post.imageUrl}
              alt={`Foto de ${post.handle} usando ${post.productName}`}
              fill
              className="object-cover group-hover:scale-108 transition-transform duration-700 ease-out"
              sizes="(max-width: 768px) 224px, 256px"
            />

            {/* Overlay Escuro com Efeito Blur no Hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-[2px] flex flex-col justify-between p-4 z-10">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[11px] font-bold text-white">
                  <InstagramIcon size={12} className="text-[#FF6500]" />
                  {post.handle}
                </span>
                <span className="w-7 h-7 rounded-full bg-[#FF6500] text-white flex items-center justify-center shadow-lg">
                  <ExternalLink size={13} />
                </span>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                  Produto Marcado
                </p>
                <p className="text-xs font-bold text-white leading-tight">
                  {post.productName}
                </p>
                <p className="text-[11px] text-[#FF6500] font-bold pt-1 flex items-center gap-1">
                  Ver no Instagram →
                </p>
              </div>
            </div>

            {/* Ícone Discreto Permanente do Instagram no Canto Superior Direito */}
            <div className="absolute top-3 right-3 z-0 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/80 group-hover:opacity-0 transition-opacity pointer-events-none">
              <InstagramIcon size={14} />
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
