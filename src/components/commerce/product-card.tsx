'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, ShoppingCart, Check, Star } from 'lucide-react';
import { formatPrice } from '@/lib/utils/formatters';
import { useCart } from '@/modules/cart/cart-context';
import { useFavorites } from '@/modules/favorites/favorites-context';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    slug: string;
    brand: string;
    basePrice: number;
    promotionalPrice?: number | null;
    images: { url: string; altText?: string | null }[];
    variants: {
      id: string;
      name: string;
      sku: string;
      price: number;
      promotionalPrice?: number | null;
      size?: string | null;
      color?: string | null;
      colorHex?: string | null;
    }[];
    categories?: { category: { name: string; slug: string } }[];
  };
  variant?: 'light' | 'dark';
}

// Map review counts and variant dots for mockup fidelity
const REVIEW_COUNTS: Record<string, number> = {
  'caneca-focus-lab': 128,
  'chaveiro-focus': 93,
  'garrafa-termica-focus': 256,
  'bone-focus-lab': 192,
  'moletom-focus-lab': 410,
  'camisa-focus-lab': 332,
};

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [added, setAdded] = useState(false);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const favorited = isFavorite(product.id) || isFavorite(product.slug);
  const primaryImage = product.images[currentImageIndex]?.url || product.images[0]?.url || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80';
  const defaultVariant = product.variants[0];
  const categoryName = product.categories?.[0]?.category.name || 'Vestuário';
  const price = defaultVariant?.price || product.basePrice;
  const reviewsCount = REVIEW_COUNTS[product.slug] || 150;

  // Extrair cores únicas do produto
  const colorList = React.useMemo(() => {
    const list: { name: string; hex: string; imgIndex: number }[] = [];
    const seen = new Set<string>();

    product.variants.forEach((v) => {
      if (v.color && !seen.has(v.color.toLowerCase())) {
        seen.add(v.color.toLowerCase());
        const isOrange = v.color.toLowerCase().includes('laranja') || v.color.toLowerCase().includes('orange');
        const isWhite = v.color.toLowerCase().includes('branco') || v.color.toLowerCase().includes('white');
        const isBlack = v.color.toLowerCase().includes('preto') || v.color.toLowerCase().includes('black');
        
        let imgIdx = 0;
        if (product.images && product.images.length > 1) {
          const found = product.images.findIndex((img) => {
            const altOrUrl = `${img.altText || ''} ${img.url || ''}`.toLowerCase();
            if (isOrange) return altOrUrl.includes('laranja') || altOrUrl.includes('orange');
            if (isWhite) return altOrUrl.includes('branco') || altOrUrl.includes('white');
            if (isBlack) return altOrUrl.includes('preto') || (!altOrUrl.includes('white') && !altOrUrl.includes('branco') && !altOrUrl.includes('orange') && !altOrUrl.includes('laranja'));
            return altOrUrl.includes(v.color!.toLowerCase());
          });
          if (found !== -1) imgIdx = found;
        }

        list.push({
          name: v.color,
          hex: v.colorHex || (isOrange ? '#FF6500' : isWhite ? '#FFFFFF' : '#0D0D0D'),
          imgIndex: imgIdx,
        });
      }
    });

    return list;
  }, [product.variants, product.images]);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!defaultVariant) return;

    addItem({
      variantId: defaultVariant.id,
      productId: product.id,
      name: product.name,
      variantName: defaultVariant.name,
      price: defaultVariant.price,
      promotionalPrice: defaultVariant.promotionalPrice,
      imageUrl: primaryImage,
      sku: defaultVariant.sku,
      quantity: 1,
      size: defaultVariant.size,
      color: defaultVariant.color,
    });

    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite({
      id: product.id,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      basePrice: product.basePrice,
      promotionalPrice: product.promotionalPrice,
      imageUrl: primaryImage,
      categories: product.categories,
      variants: product.variants,
      images: product.images,
    });
  };

  return (
    <div className="group relative flex flex-col bg-[#0F0F0F] rounded-2xl overflow-hidden border border-white/10 hover:border-[#FF6500]/50 transition-all duration-300 hover:shadow-[0_15px_30px_rgba(0,0,0,0.8)] hover:-translate-y-1 h-full justify-between select-none">
      {/* 1. TOPO: FOTO DO PRODUTO COM ILUMINAÇÃO AMBIENTE LARANJA */}
      <div className="relative aspect-square w-full bg-[#0F0F0F] overflow-hidden flex items-center justify-center">
        {/* Glow de fundo traseiro do produto */}
        <div className="absolute inset-0 bg-radial from-[#FF6500]/15 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10" />

        {/* Botão de Favorito (Coração Outline Branco / Preenchido Laranja) */}
        <button
          onClick={handleToggleFavorite}
          className="absolute top-3 right-3 z-20 p-1.5 rounded-full bg-black/50 backdrop-blur-md text-white/70 hover:text-white transition-colors focus:outline-none cursor-pointer"
          aria-label={favorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          <Heart
            size={16}
            className={favorited ? 'fill-[#FF6500] text-[#FF6500]' : 'text-white/80 hover:text-white stroke-[1.8]'}
          />
        </button>

        {/* Imagem do Produto */}
        <Link href={`/produto/${product.slug}`} className="relative w-full h-full block">
          <Image
            src={primaryImage}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-108 transition-transform duration-500"
            sizes="(max-width: 768px) 50vw, 20vw"
            quality={primaryImage.includes('/images/camisas/') ? 90 : undefined}
          />
        </Link>
      </div>

      {/* 2. BASE DO CARD: INFORMAÇÕES, AVALIAÇÃO, PREÇO & BOTÃO CARRINHO LARANJA */}
      <div className="p-3.5 sm:p-4 flex flex-col justify-between flex-1 gap-2.5 bg-[#0F0F0F] border-t border-white/5">
        <div className="space-y-1.5 flex flex-col">
          {/* Tag de Categoria com altura padronizada */}
          <div className="h-5 flex items-center">
            <span className="inline-block px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-medium text-zinc-400 tracking-wider truncate max-w-full">
              {categoryName}
            </span>
          </div>

          {/* Nome do Produto com altura padronizada para 2 linhas exatas */}
          <div className="h-9 sm:h-10 flex items-start">
            <Link
              href={`/produto/${product.slug}`}
              className="text-xs sm:text-sm font-bold text-white hover:text-[#FF6500] transition-colors line-clamp-2 leading-tight block"
              title={product.name}
            >
              {product.name}
            </Link>
          </div>

          {/* Estrelas de Avaliação + Total de Avaliações */}
          <div className="flex items-center gap-1 text-[11px] text-zinc-400 h-4">
            <div className="flex items-center text-[#FF6500]">
              <Star size={12} className="fill-[#FF6500]" />
              <Star size={12} className="fill-[#FF6500]" />
              <Star size={12} className="fill-[#FF6500]" />
              <Star size={12} className="fill-[#FF6500]" />
              <Star size={12} className="fill-[#FF6500]" />
            </div>
            <span className="text-[10px] text-zinc-500 ml-0.5">({reviewsCount})</span>
          </div>
        </div>

        {/* Linha Inferior: Preço + Cores + Botão Laranja do Carrinho 100% Alinhados */}
        <div className="flex items-end justify-between pt-2 border-t border-white/5 mt-auto">
          <div>
            <span className="text-sm sm:text-base font-black text-white tracking-tight block leading-none">
              {formatPrice(price)}
            </span>

            {/* Bolinhas de Variações/Cores interativas */}
            <div className="flex items-center gap-1.5 mt-2 h-3">
              {colorList.length > 0 ? (
                colorList.map((c, i) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCurrentImageIndex(c.imgIndex);
                    }}
                    onMouseEnter={() => setCurrentImageIndex(c.imgIndex)}
                    title={c.name}
                    className={`w-3 h-3 rounded-full border transition-transform ${
                      currentImageIndex === c.imgIndex
                        ? 'scale-125 border-[#FF6500] ring-1 ring-[#FF6500]'
                        : 'border-white/20 hover:scale-110 opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-white border border-white/20 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-600 border border-white/10 inline-block" />
                </>
              )}
            </div>
          </div>

          {/* Botão Quadrado/Arredondado Laranja de Carrinho */}
          <button
            onClick={handleAddToCart}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 shadow-md cursor-pointer flex-shrink-0 ${
              added
                ? 'bg-emerald-600 text-white scale-95 shadow-emerald-500/30'
                : 'bg-[#FF6500] hover:bg-[#FF7A1A] text-white shadow-[#FF6500]/25 hover:scale-105 active:scale-95'
            }`}
            aria-label="Adicionar ao carrinho"
          >
            {added ? <Check size={14} /> : <ShoppingCart size={15} className="stroke-[2.2]" />}
          </button>
        </div>
      </div>
    </div>
  );
}