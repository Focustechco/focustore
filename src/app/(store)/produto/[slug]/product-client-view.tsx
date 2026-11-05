'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Heart,
  ShoppingBag,
  Truck,
  RotateCcw,
  Check,
  KeyRound,
  ChevronRight,
  Star,
  Ruler,
  Info,
  X,
  Share2,
  ShieldCheck,
  Sparkles,
  Wind,
  Feather,
  Cpu,
  RefreshCw,
  CheckCircle2,
  Layers,
  Flame,
  Zap,
} from 'lucide-react';
import { Price } from '@/components/commerce/price';
import { DiscountBadge } from '@/components/commerce/discount-badge';
import { Button } from '@/components/ui/button';
import { useCart } from '@/modules/cart/cart-context';
import { useFavorites } from '@/modules/favorites/favorites-context';
import { formatInstallments, formatPrice } from '@/lib/utils/formatters';
import PRODUCT_WARRANTY from '@/modules/catalog/product-warranty.json';

const SIZE_ORDER = ['PP', 'P', 'M', 'G', 'GG', 'Único', '350ml', '750ml'];

function parseProductDescription(description: string) {
  const sections = {
    description: [] as string[],
    details: [] as string[],
    care: [] as string[],
    returns: [] as string[],
  };
  let currentSection: keyof typeof sections | null = null;

  for (const line of description.split(/\r?\n/)) {
    const heading = line.trim();
    if (heading.startsWith('### 1. Descrição & Tecnologia')) {
      currentSection = 'description';
    } else if (heading.startsWith('### 2. Especificações Técnicas')) {
      currentSection = 'details';
    } else if (heading.startsWith('### 3. Cuidados & Lavagem')) {
      currentSection = 'care';
    } else if (heading.startsWith('### 4. Garantia & Trocas')) {
      currentSection = 'returns';
    } else if (currentSection && heading) {
      sections[currentSection].push(
        currentSection === 'details' ? heading.replace(/^-\s*/, '') : heading,
      );
    }
  }

  return {
    description: sections.description.join('\n'),
    details:
      sections.details.length > 0
        ? sections.details
        : ['Informações técnicas não disponibilizadas no cadastro.'],
    care:
      sections.care.join('\n') ||
      'Instruções específicas de conservação não disponibilizadas no cadastro.',
    returns:
      sections.returns.join('\n') ||
      PRODUCT_WARRANTY.text,
  };
}

export function ProductClientView({ product }: { product: any }) {
  const router = useRouter();
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const reviewsCount = product.reviews?.length ?? 0;
  const averageRating = reviewsCount > 0
    ? product.reviews.reduce((total: number, review: { rating: number }) => total + review.rating, 0) / reviewsCount
    : null;

  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [copiedCoupon, setCopiedCoupon] = useState(false);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [keychainQuantities, setKeychainQuantities] = useState<Record<string, number>>({});
  const isFocusCap = product.slug === 'bone-focus-lab';
  const devCollectionShirtSlugs = [
    'tshirt-focus-collection',
    'polo-focus-collection',
    'bone-focus-collection',
    'camisa-dev-collection-typescript',
  ];
  const isDevCollectionShirt =
    product.slug?.startsWith('camisa-dev-collection-') ||
    devCollectionShirtSlugs.includes(product.slug);
  const capImages = [
    {
      id: 'bone-focus-black',
      url: '/images/products/bone-focus.jpg',
      altText: 'Boné Focus Lab - Preto',
    },
    {
      id: 'bone-focus-white',
      url: '/images/products/bone-focus-white-v2.jpg',
      altText: 'Boné Focus Lab - Branco',
    },
  ];
  const isKeychainProduct =
    product.slug === 'chaveiro-focus' ||
    product.name?.toLowerCase().includes('chaveiro');

  const favorited = isFavorite(product.id) || isFavorite(product.slug);
  const descriptionSections = useMemo(
    () => parseProductDescription(product.description || ''),
    [product.description],
  );

  const getProductImageUrl = (url?: string | null) => {
    if (isFocusCap && url?.endsWith('/bone-focus-white.jpg')) {
      return '/images/products/bone-focus-white-v2.jpg';
    }

    return url || '/images/products/camiseta-focus.jpg';
  };

  // Simulação de frete
  const [cep, setCep] = useState('');
  const [shippingCalculated, setShippingCalculated] = useState(false);
  const [shippingOptions, setShippingOptions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'description' | 'details' | 'care' | 'returns'>('description');

  // Extrair Cores Únicas
  const availableColors = useMemo(() => {
    if (isFocusCap) {
      return [
        { name: 'Preto', hex: '#0D0D0D' },
        { name: 'Branco', hex: '#FFFFFF' },
      ];
    }

    const colorMap = new Map<string, { name: string; hex: string }>();
    (product.variants || []).forEach((v: any) => {
      if (v.color && !colorMap.has(v.color)) {
        colorMap.set(v.color, {
          name: v.color,
          hex: v.colorHex || '#0D0D0D',
        });
      }
    });

    if (colorMap.size === 0) {
      colorMap.set('Padrão', { name: 'Padrão', hex: '#0D0D0D' });
    }

    return Array.from(colorMap.values());
  }, [isFocusCap, product.variants]);

  // Extrair Tamanhos Únicos Ordenados
  const availableSizes = useMemo(() => {
    const sizeSet = new Set<string>();
    (product.variants || []).forEach((v: any) => {
      if (v.size) sizeSet.add(v.size);
    });

    if (sizeSet.size === 0) {
      sizeSet.add('Único');
    }

    return Array.from(sizeSet).sort((a, b) => {
      const idxA = SIZE_ORDER.indexOf(a);
      const idxB = SIZE_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [product.variants]);

  // Estados de seleção de cor e tamanho
  const [selectedColor, setSelectedColor] = useState<string>(
    availableColors[0]?.name || 'Preta'
  );
  const [selectedSize, setSelectedSize] = useState<string>(
    availableSizes[0] || 'M'
  );
  const galleryImages = isFocusCap
    ? capImages.map((image, index) => ({ image, index }))
    : isDevCollectionShirt
    ? product.images
        .map((image: any, index: number) => ({ image, index }))
        .filter(({ image }: { image: any }) => {
          const label = `${image.altText || ''} ${image.url || ''}`.toLowerCase();
          const isWhite = selectedColor.toLowerCase().includes('branco');

          return isWhite
            ? label.includes('branco') || label.includes('white')
            : label.includes('preto') ||
                label.includes('black') ||
                (label.includes('frente') &&
                  !label.includes('branco') &&
                  !label.includes('white'));
        })
    : product.images.map((image: any, index: number) => ({ image, index }));
  const selectedProductImage = isFocusCap
    ? capImages[selectedImage]
    : product.images[selectedImage] || product.images[0];

  // Variação selecionada com base na Cor + Tamanho
  const selectedVariant = useMemo(() => {
    if (isFocusCap) {
      const selectedColorName = selectedColor.toLowerCase();
      const isWhite = selectedColorName.includes('branco') || selectedColorName.includes('white');
      const matchingVariant = product.variants.find((variant: any) => {
        const color = (variant.color || '').toLowerCase();
        return isWhite
          ? color.includes('branco') || color.includes('white')
          : color.includes('preto') || color.includes('black');
      });

      return matchingVariant || (isWhite ? product.variants[1] : product.variants[0]);
    }

    const exactMatch = product.variants.find(
      (v: any) =>
        (v.color || 'Padrão').toLowerCase() === selectedColor.toLowerCase() &&
        (v.size || 'Único') === selectedSize
    );
    if (exactMatch) return exactMatch;

    const colorMatch = product.variants.find(
      (v: any) => (v.color || 'Padrão').toLowerCase() === selectedColor.toLowerCase()
    );
    if (colorMatch) return colorMatch;

    return product.variants[0];
  }, [isFocusCap, product.variants, selectedColor, selectedSize]);

  // Preço e Estoque
  const currentPrice = selectedVariant?.price ?? product.basePrice;
  const currentPromoPrice = selectedVariant?.promotionalPrice ?? product.promotionalPrice;
  const hasPromotion = currentPromoPrice !== null && currentPromoPrice !== undefined && currentPromoPrice < currentPrice;
  const effectivePrice = hasPromotion
    ? currentPromoPrice
    : currentPrice;
  const availableStock = selectedVariant?.inventory?.quantityAvailable ?? 25;

  const handleColorChange = (colorName: string) => {
    setSelectedColor(colorName);

    if (isFocusCap) {
      setSelectedImage(colorName.toLowerCase().includes('branco') ? 1 : 0);
      return;
    }

    // Dynamic Image Switch: Find image matching selected color
    const colorLower = colorName.toLowerCase();
    const isOrange = colorLower.includes('laranja') || colorLower.includes('orange');
    const isWhite = colorLower.includes('branco') || colorLower.includes('white');
    const isBlack = colorLower.includes('preto') || colorLower.includes('black');

    if (product.images && product.images.length > 0) {
      const matchedIdx = product.images.findIndex((img: any) => {
        const alt = (img.altText || '').toLowerCase();
        const url = (img.url || '').toLowerCase();
        if (isOrange) return alt.includes('laranja') || alt.includes('orange') || url.includes('orange') || url.includes('laranja');
        if (isWhite) return alt.includes('branco') || alt.includes('white') || url.includes('white') || url.includes('branco');
        if (isBlack) return alt.includes('preto') || alt.includes('black') || (!url.includes('white') && !alt.includes('branco') && !url.includes('orange') && !alt.includes('laranja'));
        return alt.includes(colorLower) || url.includes(colorLower);
      });

      if (matchedIdx !== -1) {
        setSelectedImage(matchedIdx);
      }
    }

    // Checar se o tamanho atual existe para a nova cor
    const matchingVariant = product.variants.find(
      (v: any) =>
        (v.color || 'Padrão').toLowerCase() === colorName.toLowerCase() &&
        (v.size || 'Único') === selectedSize
    );
    if (!matchingVariant) {
      // Seleciona o primeiro tamanho disponível dessa cor
      const firstForColor = product.variants.find(
        (v: any) => (v.color || 'Padrão').toLowerCase() === colorName.toLowerCase()
      );
      if (firstForColor?.size) {
        setSelectedSize(firstForColor.size);
      }
    }
  };

  const handleImageSelect = (idx: number) => {
    setSelectedImage(idx);
    const img = isFocusCap ? capImages[idx] : product.images?.[idx];
    if (img) {
      const altOrUrl = `${img.altText || ''} ${img.url || ''}`.toLowerCase();
      if (altOrUrl.includes('laranja') || altOrUrl.includes('orange')) {
        const orangeColor = availableColors.find(
          (c) => c.name.toLowerCase().includes('laranja') || c.name.toLowerCase().includes('orange')
        );
        if (orangeColor) setSelectedColor(orangeColor.name);
      } else if (altOrUrl.includes('branco') || altOrUrl.includes('white')) {
        const whiteColor = availableColors.find(
          (c) => c.name.toLowerCase().includes('branco') || c.name.toLowerCase().includes('white')
        );
        if (whiteColor) setSelectedColor(whiteColor.name);
      } else if (altOrUrl.includes('preto') || altOrUrl.includes('black') || altOrUrl.includes('blk')) {
        const blackColor = availableColors.find(
          (c) => c.name.toLowerCase().includes('preto') || c.name.toLowerCase().includes('black')
        );
        if (blackColor) setSelectedColor(blackColor.name);
      }
    }
  };

  const handleSizeChange = (size: string) => {
    setSelectedSize(size);
  };

  const handleCopyCoupon = () => {
    navigator.clipboard.writeText('FOCUS10');
    setCopiedCoupon(true);
    setTimeout(() => setCopiedCoupon(false), 2000);
  };

  const handleAddToCart = () => {
    if (!selectedVariant) return;

    const keychainTotal = Object.values(keychainQuantities).reduce((sum, amount) => sum + amount, 0);
    if (isKeychainProduct && keychainTotal === 0) return;

    if (isKeychainProduct && Object.values(keychainQuantities).some((amount) => amount > 0)) {
      const selectedTypes = Object.entries(keychainQuantities)
        .filter(([, amount]) => amount > 0)
        .map(([type, amount]) => `${type} (${amount})`)
        .join(', ');
      const totalQuantity = Object.values(keychainQuantities).reduce((sum, amount) => sum + amount, 0);
      const keychainPromotionalPrice = selectedVariant.promotionalPrice ?? product.promotionalPrice;

      addItem({
        variantId: selectedVariant.id,
        productId: product.id,
        name: product.name,
        variantName: `Selecionados: ${selectedTypes}`,
<<<<<<< HEAD
        price: effectivePrice,
        promotionalPrice: null,
=======
        price: selectedVariant.price,
        promotionalPrice: keychainPromotionalPrice !== null &&
          keychainPromotionalPrice !== undefined &&
          keychainPromotionalPrice < selectedVariant.price
          ? keychainPromotionalPrice
          : null,
>>>>>>> ae5f5f607ae51cffc36f8a71f2a1524d39539ed9
        imageUrl: product.images[selectedImage]?.url || product.images[0]?.url,
        sku: selectedVariant.sku,
        quantity: totalQuantity,
        size: selectedTypes,
      });
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
      return;
    }

    const selectedPromotionalPrice = selectedVariant.promotionalPrice ?? product.promotionalPrice;
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      name: product.name,
      variantName: isFocusCap
        ? `Boné Focus Lab - ${selectedColor} / Único`
        : selectedVariant.name,
      price: selectedVariant.price,
      promotionalPrice: selectedPromotionalPrice !== null &&
        selectedPromotionalPrice !== undefined &&
        selectedPromotionalPrice < selectedVariant.price
        ? selectedPromotionalPrice
        : null,
      imageUrl: getProductImageUrl(
        selectedProductImage?.url,
      ),
      sku: selectedVariant.sku,
      quantity,
      size: selectedSize,
      color: selectedColor,
    });

    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    handleAddToCart();
    router.push('/checkout');
  };

  const handleCalculateShipping = (e: React.FormEvent) => {
    e.preventDefault();
    if (cep.replace(/\D/g, '').length === 8) {
      setShippingOptions([
        { carrier: 'Focus Express', service: 'Standard', price: 12.90, days: '2 a 4 dias úteis' },
        { carrier: 'Correios SEDEX', service: 'SEDEX Express', price: 19.50, days: '1 a 2 dias úteis' },
      ]);
      setShippingCalculated(true);
    }
  };

  return (
    <div className="space-y-12">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-muted uppercase tracking-wider">
        <Link href="/" className="hover:text-white transition-colors">Início</Link>
        <ChevronRight size={14} />
        <Link href={`/categoria/${product.categories[0]?.category.slug || 'vestuario'}`} className="hover:text-white transition-colors">
          {product.categories[0]?.category.name || 'Catálogo'}
        </Link>
        <ChevronRight size={14} />
        <span className="text-white font-semibold truncate max-w-xs">{product.name}</span>
      </nav>

      {/* Grid Principal: 55% Galeria / 45% Informações */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        {/* 55% GALERIA DE FOTOS */}
        <div className="lg:col-span-7 flex flex-col-reverse md:flex-row gap-4">
          {/* Miniaturas Verticais */}
          {galleryImages.length > 1 && (
            <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto max-h-[550px] scrollbar-none">
              {galleryImages.map(({ image: img, index: idx }: { image: any; index: number }) => (
                <button
                  key={img.id || idx}
                  onClick={() => handleImageSelect(idx)}
                  className={`relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                    selectedImage === idx
                      ? 'border-[#FF6500] shadow-md shadow-[#FF6500]/20'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <Image
                    src={getProductImageUrl(img.url)}
                    alt={img.altText || product.name}
                    fill
                    sizes="80px"
                    quality={img.url.includes('/images/camisas/') ? 90 : undefined}
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Imagem Principal Grande */}
          <div className="relative flex-1 aspect-square rounded-2xl overflow-hidden bg-[#121212] border border-white/10 group">
            <Image
              src={getProductImageUrl(selectedProductImage?.url)}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 55vw"
              quality={selectedProductImage?.url?.includes('/images/camisas/') ? 90 : undefined}
              className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
            />
            {currentPromoPrice && (
              <div className="absolute top-4 left-4">
                <DiscountBadge price={currentPrice} promotionalPrice={currentPromoPrice} />
              </div>
            )}
          </div>
        </div>

        {/* 45% INFORMAÇÕES DE COMPRA (ESTILO FIEL AO PRINT 1) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Título do Produto */}
          <div>
            <span className="text-xs font-bold text-[#FF6500] uppercase tracking-widest block mb-1">
              {product.categories[0]?.category.name || 'Focus Brand'}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
              {product.name}®
            </h1>
          </div>

          {/* Promoção e avaliações cadastradas */}
          <div className="flex flex-wrap items-center gap-2.5">
            {hasPromotion && (
              <DiscountBadge price={currentPrice} promotionalPrice={currentPromoPrice} />
            )}
            {averageRating !== null ? (
              <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-semibold pl-1">
                <Star size={13} className="fill-amber-400 text-amber-400" />
                <span>{averageRating.toFixed(1)} ({reviewsCount} {reviewsCount === 1 ? 'avaliação' : 'avaliações'})</span>
              </div>
            ) : (
              <span className="text-xs text-zinc-400 font-semibold pl-1">Sem avaliações</span>
            )}
          </div>

          {/* Preço e Cupom (Estilo Print 1) */}
          <div className="space-y-1.5 py-1">
            <div className="flex flex-wrap items-baseline gap-2.5">
              {hasPromotion ? (
                <>
                  <span className="text-zinc-500 line-through text-lg font-normal">
                    {formatPrice(currentPrice)}
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {formatPrice(effectivePrice)}
                  </span>
                </>
              ) : (
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {formatPrice(effectivePrice)}
                </span>
              )}

              <span className="text-xs text-zinc-400 font-medium flex items-center gap-1">
                com cupom{' '}
                <button
                  onClick={handleCopyCoupon}
                  title="Clique para copiar cupom"
                  className="underline font-bold text-white hover:text-[#FF6500] transition-colors inline-flex items-center gap-1"
                >
                  FOCUS10
                  {copiedCoupon && <span className="text-[10px] text-emerald-400">✓ Copiado!</span>}
                </button>
              </span>
            </div>

            <p className="text-xs text-emerald-400 font-medium">
              ou {formatPrice(effectivePrice * 0.90)} à vista no PIX (10% OFF extra)
            </p>
            <p className="text-[11px] text-zinc-400">
              {formatInstallments(effectivePrice, 12)}
            </p>
          </div>

          {/* =========================================================
              SELETOR DE CORES FIEL AO PRINT 1 (COR: PRETA)
              ========================================================= */}
          {!isKeychainProduct && availableColors.length > 0 && (
            <div className="space-y-2.5 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white uppercase tracking-wider">
                  COR: <span className="font-extrabold text-zinc-200">{selectedColor.toUpperCase()}</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {availableColors.map((color) => {
                  const isSelected = selectedColor.toLowerCase() === color.name.toLowerCase();
                  const isLight = color.hex.toLowerCase() === '#f4f3e8' || color.hex.toLowerCase() === '#ffffff';

                  return (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => handleColorChange(color.name)}
                      className={`group relative rounded-full transition-all duration-200 flex items-center justify-center p-0.5 focus:outline-none ${
                        isSelected
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-[#080808] scale-105'
                          : 'hover:scale-110 opacity-85 hover:opacity-100'
                      }`}
                      title={color.name}
                      aria-label={`Selecionar cor ${color.name}`}
                    >
                      <span
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-white/20 shadow-inner flex items-center justify-center"
                        style={{ backgroundColor: color.hex }}
                      >
                        {isSelected && (
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor: isLight ? '#000000' : '#FFFFFF',
                            }}
                          />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* =========================================================
              SELETOR DE TAMANHOS FIEL AO PRINT 1 (TAMANHO)
              ========================================================= */}
          {!isKeychainProduct && availableSizes.length > 0 && (
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white uppercase tracking-wider">
                  TAMANHO
                </span>
                <button
                  type="button"
                  onClick={() => setShowSizeGuide(true)}
                  className="text-[11px] text-zinc-400 hover:text-white underline tracking-wide font-medium flex items-center gap-1 transition-colors"
                >
                  <Ruler size={13} />
                  <span>Tabela de chaveiros</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {availableSizes.map((size) => {
                  const isSelected = selectedSize === size;
                  const matchingVariant = product.variants.find(
                    (v: any) =>
                      (v.color || 'Padrão').toLowerCase() === selectedColor.toLowerCase() &&
                      (v.size || 'Único') === size
                  );
                  const isOutOfStock = matchingVariant && matchingVariant.inventory?.quantityAvailable <= 0;

                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => handleSizeChange(size)}
                      className={`min-w-[48px] h-10 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center border focus:outline-none ${
                        isSelected
                          ? 'bg-white text-black border-white shadow-lg font-black scale-[1.02]'
                          : isOutOfStock
                          ? 'bg-[#121212] border-white/5 text-zinc-600 cursor-not-allowed line-through'
                          : 'bg-[#141414] border-white/10 text-zinc-300 hover:border-white/40 hover:text-white'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isKeychainProduct && (
            <button
              type="button"
              onClick={() => setShowSizeGuide(true)}
              className="cursor-pointer text-sm text-zinc-300 hover:text-white underline decoration-[#FF6500] underline-offset-4 tracking-wide font-semibold flex items-center gap-2 transition-colors"
            >
              <KeyRound size={18} />
              <span>Selecionar chaveiro</span>
            </button>
          )}

          {/* Quantidade e Disponibilidade */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Qtd:</span>
              <div className="flex items-center border border-white/10 rounded-lg bg-[#141414]">
                <button
                  onClick={() => {
                    const nextQuantity = Math.max(0, quantity - 1);
                    setQuantity(nextQuantity);
                    if (isKeychainProduct && nextQuantity === 0) {
                      setKeychainQuantities({});
                    }
                  }}
                  className="w-8 h-8 text-xs text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  -
                </button>
                <span className="w-8 text-xs font-bold text-white text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(availableStock || 10, quantity + 1))}
                  className="w-8 h-8 text-xs text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
              <Check size={14} /> {availableStock > 0 ? `${availableStock} unidades em estoque` : 'Esgotado'}
            </span>
          </div>

          {/* Botões de Ação */}
          <div className="space-y-3 pt-2">
            <Button
              onClick={handleAddToCart}
              fullWidth
              size="lg"
              disabled={availableStock <= 0 || (isKeychainProduct && Object.values(keychainQuantities).reduce((sum, amount) => sum + amount, 0) <= 0)}
              className="gap-2 bg-[#FF6500] hover:bg-[#FF7A1A] font-black uppercase text-white shadow-lg shadow-[#FF6500]/25"
            >
              {added ? (
                <>
                  <Check size={18} className="text-white" /> Adicionado ao Carrinho!
                </>
              ) : (
                <>
                  <ShoppingBag size={18} /> ADICIONAR AO CARRINHO
                </>
              )}
            </Button>

            <div className="flex gap-3">
              <Button
                onClick={handleBuyNow}
                variant="secondary"
                fullWidth
                size="md"
                disabled={availableStock <= 0 || (isKeychainProduct && Object.values(keychainQuantities).reduce((sum, amount) => sum + amount, 0) <= 0)}
                className="font-bold border border-white/15 hover:border-white/30"
              >
                COMPRAR AGORA
              </Button>

              <button
                onClick={() =>
                  toggleFavorite({
                    id: product.id,
                    name: product.name,
                    slug: product.slug,
                    brand: product.brand,
                    basePrice: product.basePrice,
                    promotionalPrice: product.promotionalPrice,
                    imageUrl: getProductImageUrl(product.images?.[0]?.url),
                    categories: product.categories,
                    variants: product.variants,
                    images: product.images,
                  })
                }
                className={`p-3 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                  favorited
                    ? 'border-[#FF6500] text-[#FF6500] bg-[#FF6500]/10'
                    : 'border-white/10 bg-[#141414] text-zinc-400 hover:text-white'
                }`}
                aria-label={favorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              >
                <Heart size={20} className={favorited ? 'fill-[#FF6500] text-[#FF6500]' : ''} />
              </button>
            </div>
          </div>

          {/* Calculadora de Frete CEP */}
          <div className="p-4 rounded-xl bg-[#121212] border border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
              <Truck size={16} className="text-[#FF6500]" />
              <span>Simular Frete e Prazo</span>
            </div>
            <form onSubmit={handleCalculateShipping} className="flex gap-2">
              <input
                type="text"
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                placeholder="00000-000"
                maxLength={9}
                className="flex-1 bg-[#181818] border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF6500]"
              />
              <Button size="sm" variant="outline" type="submit" className="text-xs">
                Calcular
              </Button>
            </form>

            {shippingCalculated && (
              <div className="space-y-2 pt-2 border-t border-white/5 text-xs">
                {shippingOptions.map((opt, i) => (
                  <div key={i} className="flex justify-between items-center text-zinc-400">
                    <span>{opt.carrier} ({opt.days})</span>
                    <span className="font-bold text-white">{formatPrice(opt.price)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs com Detalhes Tecnológicos, Especificações e Cuidados */}
      <div className="pt-8 border-t border-white/10 space-y-6">
        {/* Navegação Minimalista das Abas */}
        <div className="flex border-b border-white/10 gap-8 text-xs font-bold uppercase tracking-wider overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('description')}
            className={`pb-3 transition-colors relative whitespace-nowrap ${
              activeTab === 'description' ? 'text-[#FF6500]' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Descrição & Tecnologia
            {activeTab === 'description' && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#FF6500]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-3 transition-colors relative whitespace-nowrap ${
              activeTab === 'details' ? 'text-[#FF6500]' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Especificações Técnicas
            {activeTab === 'details' && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#FF6500]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('care')}
            className={`pb-3 transition-colors relative whitespace-nowrap ${
              activeTab === 'care' ? 'text-[#FF6500]' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Cuidados & Lavagem
            {activeTab === 'care' && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#FF6500]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('returns')}
            className={`pb-3 transition-colors relative whitespace-nowrap ${
              activeTab === 'returns' ? 'text-[#FF6500]' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Garantia & Trocas
            {activeTab === 'returns' && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#FF6500]" />
            )}
          </button>
        </div>

        {activeTab === 'description' && (
          <section className="max-w-3xl space-y-3 text-sm leading-relaxed">
            <h3 className="text-lg font-bold text-white">Descrição & Tecnologia</h3>
            <p className="whitespace-pre-line text-zinc-300">
              {descriptionSections.description || product.description}
            </p>
          </section>
        )}

        {activeTab === 'details' && (
          <section className="max-w-3xl space-y-3 text-sm">
            <h3 className="text-lg font-bold text-white">Especificações Técnicas</h3>
            <ul className="list-disc space-y-2 pl-5 text-zinc-300">
              {descriptionSections.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          </section>
        )}

        {activeTab === 'care' && (
          <section className="max-w-3xl space-y-3 text-sm leading-relaxed">
            <h3 className="text-lg font-bold text-white">Cuidados & Lavagem</h3>
            <p className="whitespace-pre-line text-zinc-300">{descriptionSections.care}</p>
          </section>
        )}

        {activeTab === 'returns' && (
          <section className="max-w-3xl space-y-3 text-sm leading-relaxed">
            <h3 className="text-lg font-bold text-white">Garantia & Trocas</h3>
            <div className="space-y-4 text-zinc-300">
              {descriptionSections.returns.split(/\n{2,}/).map((paragraph) => {
                const match = paragraph.match(/^([^:\n]+):\s*(.*)$/s);
                return (
                  <p key={paragraph}>
                    {match ? (
                      <>
                        <strong className="text-white">{match[1]}:</strong> {match[2]}
                      </>
                    ) : (
                      paragraph
                    )}
                  </p>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Modal Guia de Tamanhos */}
      {showSizeGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 relative shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                {isKeychainProduct ? (
                  <KeyRound size={20} className="text-[#FF6500]" />
                ) : (
                  <Ruler size={18} className="text-[#FF6500]" />
                )}
                <h3 className="font-bold text-white text-base">
                  {isKeychainProduct ? 'Tabela de chaveiros' : 'Tabela de Medidas (cm)'}
                </h3>
              </div>
              <button
                onClick={() => setShowSizeGuide(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {isKeychainProduct && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-zinc-300">
                  <thead className="bg-[#1C1C1C] text-zinc-400 font-bold uppercase">
                    <tr>
                      <th className="p-2.5">Tipo</th>
                      <th className="p-2.5">Estoque</th>
                      <th className="p-2.5 text-center">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {product.variants.map((variant: any) => {
                      const type = variant.size || variant.name;
                      const stock = variant.inventory?.quantityAvailable ?? 20;
                      const selectedQuantity = keychainQuantities[type] || 0;
                      return (
                        <tr key={variant.id || type}>
                          <td className="p-2.5 font-bold text-white">{type}</td>
                          <td className="p-2.5">{stock}</td>
                          <td className="p-2.5">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setKeychainQuantities((current) => ({
                                  ...current,
                                  [type]: Math.max(0, (current[type] || 0) - 1),
                                }))}
                                className="w-7 h-7 rounded border border-white/10 text-zinc-300 hover:text-white"
                              >
                                -
                              </button>
                              <span className="w-5 text-center font-bold text-white">{selectedQuantity}</span>
                              <button
                                type="button"
                                onClick={() => setKeychainQuantities((current) => ({
                                  ...current,
                                  [type]: Math.min(stock, (current[type] || 0) + 1),
                                }))}
                                className="w-7 h-7 rounded border border-white/10 text-zinc-300 hover:text-white disabled:opacity-40"
                                disabled={selectedQuantity >= stock}
                              >
                                +
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!isKeychainProduct && <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-zinc-300">
                <thead className="bg-[#1C1C1C] text-zinc-400 font-bold uppercase">
                  <tr>
                    <th className="p-2.5">Tamanho</th>
                    <th className="p-2.5">Tórax</th>
                    <th className="p-2.5">Comprimento</th>
                    <th className="p-2.5">Manga</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr><td className="p-2.5 font-bold text-white">PP</td><td className="p-2.5">92 - 96</td><td className="p-2.5">68</td><td className="p-2.5">20</td></tr>
                  <tr><td className="p-2.5 font-bold text-white">P</td><td className="p-2.5">96 - 100</td><td className="p-2.5">70</td><td className="p-2.5">21</td></tr>
                  <tr><td className="p-2.5 font-bold text-white">M</td><td className="p-2.5">100 - 106</td><td className="p-2.5">72</td><td className="p-2.5">22</td></tr>
                  <tr><td className="p-2.5 font-bold text-white">G</td><td className="p-2.5">106 - 112</td><td className="p-2.5">74</td><td className="p-2.5">23</td></tr>
                  <tr><td className="p-2.5 font-bold text-white">GG</td><td className="p-2.5">112 - 120</td><td className="p-2.5">76</td><td className="p-2.5">24</td></tr>
                </tbody>
              </table>
            </div>}

            {!isKeychainProduct && <p className="text-[11px] text-zinc-500 italic">
              * Medidas aproximadas em centímetros. Em caso de dúvida entre dois tamanhos, sugerimos escolher o maior para modelagem streetwear.
            </p>}

            <Button
              onClick={() => {
                if (isKeychainProduct) {
                  const total = Object.values(keychainQuantities).reduce((sum, amount) => sum + amount, 0);
                  setQuantity(total);
                }
                setShowSizeGuide(false);
              }}
              fullWidth
              size="sm"
              className="bg-[#FF6500] text-white font-bold"
            >
              {isKeychainProduct ? 'Confirmar' : 'Entendido'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}