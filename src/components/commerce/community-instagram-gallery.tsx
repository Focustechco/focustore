'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';

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
}

const COMMUNITY_POSTS: CommunityPost[] = [
  {
    id: 'post-real-1',
    handle: '@team.focus',
    imageUrl: '/images/community/real-team-duo.jpg',
    productName: 'Camisa Focus Classic Black',
  },
  {
    id: 'post-real-2',
    handle: '@focus.techcrew',
    imageUrl: '/images/community/real-team-booth.jpg',
    productName: 'Camisa Focus Oficial & Drop Summit',
  },
  {
    id: 'post-real-3',
    handle: '@raul.tech',
    imageUrl: '/images/community/real-event-attendee.jpg',
    productName: 'Camisa Focus Oficial Tech Summit',
  },
  {
    id: 'post-real-4',
    handle: '@felipe.creator',
    imageUrl: '/images/community/real-event-tripod.jpg',
    productName: 'Camisa Focus Classic Black',
  },
  {
    id: 'post-real-5',
    handle: '@joao.dev',
    imageUrl: '/images/community/real-office-desk.jpg',
    productName: 'Camisa Focus & Caderno Focus',
  },
  {
    id: 'post-6',
    handle: '@lucas.dev',
    imageUrl: '/images/community/post-hoodie-cafe.jpg',
    productName: 'Moletom Focus Streetwear',
  },
  {
    id: 'post-7',
    handle: '@tech.mariana',
    imageUrl: '/images/community/post-tee-workspace.jpg',
    productName: 'Camisa Focus Classic Black',
  },
  {
    id: 'post-8',
    handle: '@yuki.code',
    imageUrl: '/images/community/post-cap-street.jpg',
    productName: 'Boné Focus Lab Structured',
  },
  {
    id: 'post-9',
    handle: '@gabriela.design',
    imageUrl: '/images/community/post-sweatshirt-loft.jpg',
    productName: 'Sweatshirt Focus Lab Arch',
  },
  {
    id: 'post-10',
    handle: '@pedro.founder',
    imageUrl: '/images/community/post-polo-rooftop.jpg',
    productName: 'Polo Focus Tech & Copo Térmico',
  },
];

export function CommunityInstagramGallery({ banners }: { banners?: any[] }) {
  const [selectedPostIndex, setSelectedPostIndex] = useState<number | null>(null);
  const pointerStartX = useRef<number | null>(null);

  const posts =
    banners && banners.length > 0
      ? banners.map((b) => ({
          id: b.id,
          handle: b.title || '@focus.store',
          imageUrl: b.imageUrl,
          productName: b.subtitle || 'Focus Techwear & Lifestyle',
        }))
      : COMMUNITY_POSTS;

  useEffect(() => {
    if (selectedPostIndex === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedPostIndex(null);
      if (event.key === 'ArrowLeft') {
        setSelectedPostIndex((current) =>
          current === null ? null : (current - 1 + posts.length) % posts.length,
        );
      }
      if (event.key === 'ArrowRight') {
        setSelectedPostIndex((current) =>
          current === null ? null : (current + 1) % posts.length,
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedPostIndex, posts.length]);

  const handleSwipeEnd = (clientX: number) => {
    if (pointerStartX.current === null) return;

    const swipeDistance = clientX - pointerStartX.current;
    pointerStartX.current = null;

    if (Math.abs(swipeDistance) < 50) return;

    setSelectedPostIndex((current) => {
      if (current === null) return null;
      return swipeDistance < 0
        ? (current + 1) % posts.length
        : (current - 1 + posts.length) % posts.length;
    });
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

      </div>

      {/* Grid / Carrossel Horizontal Fluido */}
      <div
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory"
      >
        {posts.map((post, index) => (
          <div
            key={post.id}
            className="group relative flex-shrink-0 w-56 sm:w-64 aspect-square rounded-2xl overflow-hidden bg-[#121212] border border-white/10 hover:border-[#FF6500]/50 transition-all duration-300 shadow-xl snap-start"
          >
            <button
              type="button"
              onClick={() => setSelectedPostIndex(index)}
              aria-label={`Ampliar foto de ${post.handle}`}
              className="relative block h-full w-full text-left"
            >
              {/* Foto do Post */}
              <Image
                src={post.imageUrl}
                alt={`Foto da comunidade usando ${post.productName}`}
                fill
                className="object-cover group-hover:scale-108 transition-transform duration-700 ease-out"
                sizes="(max-width: 768px) 224px, 256px"
              />

              {/* Overlay Escuro com Efeito Blur no Hover */}
              <div className="absolute inset-0 z-10 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/50 to-black/20 p-4 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:opacity-100">
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                    Produto Marcado
                  </p>
                  <p className="text-xs font-bold text-white leading-tight">
                    {post.productName}
                  </p>
                  <p className="text-[11px] text-[#FF6500] font-bold pt-1 flex items-center gap-1">
                    Ver foto ampliada
                  </p>
                </div>
              </div>
            </button>

            <a
              href="https://www.instagram.com/focustech.co/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir Instagram da loja"
              className="absolute top-3 right-3 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/80 backdrop-blur-md transition-colors group-hover:text-[#FF6500]"
            >
              <InstagramIcon size={14} />
            </a>
          </div>
        ))}
      </div>

      {selectedPostIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Foto da comunidade"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          onClick={() => setSelectedPostIndex(null)}
          onPointerDown={(event) => {
            pointerStartX.current = event.clientX;
          }}
          onPointerUp={(event) => handleSwipeEnd(event.clientX)}
          onPointerCancel={() => {
            pointerStartX.current = null;
          }}
          style={{ touchAction: 'pan-y' }}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-4xl flex-col items-center gap-3"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedPostIndex(null)}
              aria-label="Fechar foto ampliada"
              className="absolute -top-12 right-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black"
            >
              <X size={22} />
            </button>
            <div className="relative h-[min(75vh,800px)] w-[min(90vw,800px)] max-w-full">
              <Image
                src={posts[selectedPostIndex].imageUrl}
                alt={`Foto de ${posts[selectedPostIndex].handle} usando ${posts[selectedPostIndex].productName}`}
                fill
                className="select-none object-contain"
                sizes="(max-width: 768px) 90vw, 800px"
                priority
                draggable={false}
              />
            </div>
            <p className="text-center text-sm font-semibold text-white">
              {posts[selectedPostIndex].productName}
            </p>
            <p className="text-xs text-zinc-400">Arraste para o lado para ver outras fotos</p>
          </div>
        </div>
      )}
    </section>
  );
}
