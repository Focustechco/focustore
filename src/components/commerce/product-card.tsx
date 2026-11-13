'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, ShoppingCart, Check } from 'lucide-react';
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
    _count?: { reviews: number };
    catalogSource?: 'fastapi' | 'prisma';
  };
  variant?: 'light' | 'dark';
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [added, setAdded] = useState(false);
  const isReadOnlyCatalog = product.catalogSource === 'fastapi';

  const isFocusCap = product.slug === 'bone-focus-lab';
  const isKeychainProduct = product.slug === 'chaveiro-focus';
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const favorited = isFavorite(product.id) || isFavorite(product.slug);
  const selectedImage = product.images[currentImageIndex] || product.images[0];
  const primaryImage = isFocusCap
    ? currentImageIndex === 0
      ? '/images/products/bone-focus.jpg'
      : '/images/products/bone-focus-white.png'
    : selectedImage?.url || '/images/products/placeholder.svg';
  const frontImage = product.images.find((image) =>
    image.altText?.toLowerCase().includes('frente')
  );
  const selectedImageLabel =
    `${selectedImage?.altText || ''} ${selectedImage?.url || ''}`.toLowerCase();
  const isWhiteSelected =
    selectedImageLabel.includes('branco') || selectedImageLabel.includes('white');
  const blackFrontImage = product.images.find((image) => {
    const label = `${image.altText || ''} ${image.url || ''}`.toLowerCase();
    return label.includes('frente') &&
      !label.includes('branco') &&
      !label.includes('white');
  });
  const whiteFrontImage = product.images.find((image) => {
    const label = `${image.altText || ''} ${image.url || ''}`.toLowerCase();
    return label.includes('frente') &&
      (label.includes('branco') || label.includes('white'));
  });
  const academyFemaleImage = product.slug === 'camisa-focus-academy'
    ? product.images.find((image) => image.url.includes('camisa-focus-academy-feminina.png'))
    : undefined;
  const hoverImage =
    academyFemaleImage ||
    (isWhiteSelected ? whiteFrontImage : blackFrontImage || frontImage);
  const keepsImageOnHover =
    ['caderno-focus', 'camisa-focus-lab', 'moletom-focus-hoodie', 'moletom-focus-lab'].includes(product.slug) ||
    product.slug.startsWith('bone-');
  const canPreviewFront = !keepsImageOnHover && Boolean(hoverImage);
  const defaultVariant = product.variants[0];
  const price = defaultVariant?.price ?? product.basePrice;
  const promotionalPrice = defaultVariant?.promotionalPrice ?? product.promotionalPrice;
  const effectivePrice = promotionalPrice !== null && promotionalPrice !== undefined && promotionalPrice < price
    ? promotionalPrice
    : price;

  // Extrair cores únicas do produto
  const colorList = React.useMemo(() => {
    if (product.slug === 'bone-focus-lab') {
      return [
        { name: 'Preto', hex: '#0D0D0D', imgIndex: 0 },
        { name: 'Branco', hex: '#FFFFFF', imgIndex: 1 },
      ];
    }
    if (product.slug === 'moletom-focus-hoodie') {
      const imageIndexByColor = (color: string) =>
        product.images.findIndex((image) => {
          const label = `${image.altText || ''} ${image.url || ''}`.toLowerCase();
          return color === 'Preto'
            ? label.includes('preto') || label.includes('black')
            : label.includes('branco') || label.includes('white');
        });
      return [
        { name: 'Preto', hex: '#0D0D0D', imgIndex: Math.max(imageIndexByColor('Preto'), 0) },
        { name: 'Branco', hex: '#FFFFFF', imgIndex: Math.max(imageIndexByColor('Branco'), 0) },
      ];
    }
    if (isKeychainProduct) {
      return [{ name: 'Preto', hex: '#0D0D0D', imgIndex: 0 }];
    }

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
  }, [isKeychainProduct, product.slug, product.variants, product.images]);

  const selectedColor = colorList.find((color) => color.imgIndex === currentImageIndex)?.name;
  const selectedVariant = isFocusCap
    ? product.variants.find((variant) => {
        const color = variant.color?.toLowerCase() || '';
        return currentImageIndex === 1
          ? color.includes('branco') || color.includes('white')
          : color.includes('preto') || color.includes('black');
      }) || (currentImageIndex === 1 ? product.variants[1] : product.variants[0])
    : selectedColor
    ? product.variants.find((variant) => {
        const color = variant.color?.toLowerCase() || '';
        const normalizedSelectedColor = selectedColor.toLowerCase();
        return color === normalizedSelectedColor ||
          (normalizedSelectedColor === 'preto' && (color.includes('preto') || color.includes('black'))) ||
          (normalizedSelectedColor === 'branco' && (color.includes('branco') || color.includes('white')));
      }) || product.variants[0]
    : product.variants[0];

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isReadOnlyCatalog || !selectedVariant) return;
    const selectedPromotionalPrice = selectedVariant.promotionalPrice ?? product.promotionalPrice;

    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      name: product.name,
      variantName: isFocusCap
        ? `Boné Focus Lab - ${currentImageIndex === 1 ? 'Branco' : 'Preto'} / Único`
        : selectedVariant.name,
      price: selectedVariant.price,
      promotionalPrice: selectedPromotionalPrice !== null &&
        selectedPromotionalPrice !== undefined &&
        selectedPromotionalPrice < selectedVariant.price
        ? selectedPromotionalPrice
        : null,
      imageUrl: primaryImage,
      sku: selectedVariant.sku,
      quantity: 1,
      size: selectedVariant.size,
      color: isFocusCap ? (currentImageIndex === 1 ? 'Branco' : 'Preto') : selectedVariant.color,
      catalogSource: product.catalogSource,
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
      catalogSource: product.catalogSource,
    });
  };

  return (
    <div className="group relative flex h-full select-none flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-[#0D0D0D] transition-colors duration-300 hover:border-white/25">
      {/* 1. TOPO: FOTO DO PRODUTO COM ILUMINAÇÃO AMBIENTE LARANJA */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#111]">
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
        <Link href={`/produto/${product.slug}`} className="group/image relative w-full h-full block">
          <Image
            src={primaryImage}
            alt={product.name}
            fill
            className={`${
              isKeychainProduct
                ? 'object-cover scale-[1.12] group-hover:scale-[1.2] transition-all duration-500 ease-in-out'
                : `object-cover ${
                    canPreviewFront
                      ? 'transition-opacity duration-500 ease-in-out'
                      : 'group-hover:scale-108 transition-transform duration-500'
                  }`
            } ${canPreviewFront ? 'group-hover/image:opacity-0' : ''}`}
            sizes="(max-width: 768px) 50vw, 20vw"
            quality={primaryImage.includes('/images/camisas/') ? 90 : undefined}
          />
          {canPreviewFront && hoverImage && (
            <Image
              src={hoverImage.url}
              alt={hoverImage.altText || `${product.name} - Frente`}
              fill
              className={`${product.slug === 'chaveiro-focus' ? 'object-cover scale-[1.12]' : 'object-cover'} opacity-0 group-hover/image:opacity-100 transition-opacity duration-500 ease-in-out`}
              sizes="(max-width: 768px) 50vw, 20vw"
              quality={hoverImage.url.includes('/images/camisas/') ? 90 : undefined}
            />
          )}
        </Link>
      </div>

      {/* 2. BASE DO CARD: INFORMAÇÕES, AVALIAÇÃO, PREÇO & BOTÃO CARRINHO LARANJA */}
      <div className="flex flex-1 flex-col justify-between gap-2.5 border-t border-white/5 bg-[#0D0D0D] p-3 sm:p-4">
        <div className="space-y-1.5 flex flex-col">
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

        </div>

        {/* Linha Inferior: Preço + Cores + Botão Laranja do Carrinho 100% Alinhados */}
        <div className="flex items-end justify-between pt-2 border-t border-white/5 mt-auto">
          <div>
            <span className="text-sm sm:text-base font-black text-white tracking-tight block leading-none">
              {formatPrice(effectivePrice)}
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
                <span className="sr-only">Sem opções de cor cadastradas</span>
              )}
            </div>
          </div>

          {/* Botão Quadrado/Arredondado Laranja de Carrinho */}
          <button
            onClick={handleAddToCart}
            disabled={isReadOnlyCatalog}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 shadow-md cursor-pointer flex-shrink-0 ${
              added
                ? 'bg-emerald-600 text-white scale-95 shadow-emerald-500/30'
                : 'bg-[#FF6500] hover:bg-[#FF7A1A] text-white shadow-[#FF6500]/25 hover:scale-105 active:scale-95'
            } ${isReadOnlyCatalog ? 'cursor-not-allowed opacity-50 hover:bg-[#FF6500] hover:scale-100' : ''}`}
            aria-label={isReadOnlyCatalog ? 'Compra indisponível para o catálogo FastAPI experimental' : 'Adicionar ao carrinho'}
            title={isReadOnlyCatalog ? 'Catálogo FastAPI disponível somente para consulta.' : undefined}
          >
            {added ? <Check size={14} /> : <ShoppingCart size={15} className="stroke-[2.2]" />}
          </button>
        </div>
      </div>
    </div>
  );
}
