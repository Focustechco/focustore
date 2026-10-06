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

const SIZE_ORDER = ['PP', 'P', 'M', 'G', 'GG', 'Único', '350ml', '750ml'];

export function ProductClientView({ product }: { product: any }) {
  const router = useRouter();
  const { addItem } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [copiedCoupon, setCopiedCoupon] = useState(false);
  const [showSizeGuide, setShowSizeGuide] = useState(false);

  const favorited = isFavorite(product.id) || isFavorite(product.slug);

  // Simulação de frete
  const [cep, setCep] = useState('');
  const [shippingCalculated, setShippingCalculated] = useState(false);
  const [shippingOptions, setShippingOptions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'description' | 'details' | 'care' | 'returns'>('description');

  // Extrair Cores Únicas
  const availableColors = useMemo(() => {
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
  }, [product.variants]);

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

  // Variação selecionada com base na Cor + Tamanho
  const selectedVariant = useMemo(() => {
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
  }, [product.variants, selectedColor, selectedSize]);

  // Preço e Estoque
  const currentPrice = selectedVariant?.price || product.basePrice;
  const currentPromoPrice = selectedVariant?.promotionalPrice || product.promotionalPrice;
  const effectivePrice = currentPromoPrice || currentPrice;
  const availableStock = selectedVariant?.inventory?.quantityAvailable ?? 25;

  const handleColorChange = (colorName: string) => {
    setSelectedColor(colorName);

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
    const img = product.images?.[idx];
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

    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      name: product.name,
      variantName: selectedVariant.name,
      price: selectedVariant.price,
      promotionalPrice: selectedVariant.promotionalPrice,
      imageUrl: product.images[selectedImage]?.url || product.images[0]?.url,
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
          {product.images.length > 1 && (
            <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto max-h-[550px] scrollbar-none">
              {product.images.map((img: any, idx: number) => (
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
                    src={img.url}
                    alt={img.altText || product.name}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Imagem Principal Grande */}
          <div className="relative flex-1 aspect-square rounded-2xl overflow-hidden bg-[#121212] border border-white/10 group">
            <Image
              src={product.images[selectedImage]?.url || product.images[0]?.url || '/images/products/camiseta-focus.jpg'}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 55vw"
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

          {/* Badges e Avaliações (Estilo Print 1) */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-md border border-white/25 text-[11px] font-black text-white uppercase tracking-wider bg-black/50 backdrop-blur-sm">
              20% OFF
            </span>
            <span className="px-2.5 py-1 rounded-md bg-[#0D2A4A] border border-[#1E4E79] text-[11px] font-black text-sky-200 uppercase tracking-wider">
              COMBINE & GANHE
            </span>
            <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-semibold pl-1">
              <Star size={13} className="fill-amber-400 text-amber-400" />
              <span>4,9 (25988 reviews)</span>
            </div>
          </div>

          {/* Preço e Cupom (Estilo Print 1) */}
          <div className="space-y-1.5 py-1">
            <div className="flex flex-wrap items-baseline gap-2.5">
              {currentPromoPrice ? (
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
          {availableColors.length > 0 && (
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
          {availableSizes.length > 0 && (
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
                  <span>Tabela de medidas</span>
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

          {/* Quantidade e Disponibilidade */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Qtd:</span>
              <div className="flex items-center border border-white/10 rounded-lg bg-[#141414]">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
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
              disabled={availableStock <= 0}
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
                disabled={availableStock <= 0}
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
                    imageUrl: product.images?.[0]?.url,
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

        {/* 1. ABA DESCRIÇÃO & TECNOLOGIA (CLEAN & MINIMALISTA) */}
        {activeTab === 'description' && (
          <div className="space-y-6 max-w-3xl text-sm leading-relaxed">
            {/* Parágrafo Principal */}
            <p className="text-zinc-300 text-sm sm:text-base">
              {product.description}
            </p>

            {(product.slug?.includes('camiseta') ||
              product.slug?.includes('moletom') ||
              product.slug?.includes('polo') ||
              product.isApparel) ? (
              <div className="space-y-5 pt-2">
                <div className="space-y-4 text-zinc-400 text-sm">
                  <div>
                    <h4 className="font-bold text-white text-sm mb-1">
                      Tecnologia Anti-Odor & Antimicrobiana
                    </h4>
                    <p>
                      Tratamento biotecnológico com nanopartículas que inibem em até 99,8% a proliferação de bactérias causadoras de odores. Mantém a peça fresca e com sensação de recém-lavada durante todo o dia de trabalho ou viagens longas.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-sm mb-1">
                      Tecido Anti-Amasso (Wrinkle-Free Tech)
                    </h4>
                    <p>
                      Fibras inteligentes com memória de forma e alta recuperação elástica. Não amarrota ao sentar na cadeira de trabalho nem dentro da mochila. Os vincos suavizam naturalmente com o próprio calor do corpo ao vestir, dispensando o uso de ferro.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-sm mb-1">
                      Termorregulação & Respirabilidade Ativa
                    </h4>
                    <p>
                      Estrutura de micro-trama aerada que acelera a evaporação da umidade e proporciona circulação contínua de ar, equilibrando a temperatura tanto no calor quanto em ambientes climatizados de escritório.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-sm mb-1">
                      Ergonomia & Modelagem Funcional
                    </h4>
                    <p>
                      Costura plana reforçada ombro a ombro com pesponto duplo, gola em ribana canelada 2x1 anti-esgarçamento e etiqueta interna termocolante Flat-Seam sem atrito ou incômodo no pescoço.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setShowSizeGuide(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF6500] hover:underline cursor-pointer"
                  >
                    <Ruler size={13} />
                    <span>Consultar Tabela de Medidas (cm)</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-2 text-zinc-400 text-sm">
                <div>
                  <h4 className="font-bold text-white text-sm mb-1">
                    Construção em Materiais Nobres
                  </h4>
                  <p>
                    Materiais de nível industrial usinados com precisão, projetados para máxima durabilidade, estética clean e resistência ao uso diário contínuo.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm mb-1">
                    Design Ergonômico & Produtividade
                  </h4>
                  <p>
                    Projetado para aprimorar sua rotina de trabalho, organização do setup e conforto visual durante o dia a dia de código e criação.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. ABA ESPECIFICAÇÕES TÉCNICAS (CLEAN) */}
        {activeTab === 'details' && (
          <div className="max-w-3xl text-sm">
            <div className="divide-y divide-white/10 text-xs">
              {(product.slug?.includes('camiseta') ||
                product.slug?.includes('moletom') ||
                product.slug?.includes('polo') ||
                product.isApparel) ? (
                <>
                  <div className="py-2.5 flex justify-between gap-4">
                    <span className="text-zinc-400 font-medium">Tecnologia do Tecido</span>
                    <span className="text-white text-right font-medium">Focus TechFiber™ (Anti-Odor + Wrinkle-Free)</span>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <span className="text-zinc-400 font-medium">Composição</span>
                    <span className="text-white text-right font-medium">
                      {product.slug?.includes('moletom')
                        ? '100% Algodão Nobre Heavyweight (380g/m²) peluciado'
                        : product.slug?.includes('polo')
                        ? '97% Algodão Piquet + 3% Elastano Inteligente'
                        : '100% Algodão Egípcio Penteado Peletizado'}
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <span className="text-zinc-400 font-medium">Gramatura</span>
                    <span className="text-white text-right font-medium">
                      {product.slug?.includes('moletom') ? '380 g/m² (Heavyweight Fleece)' : '260 g/m² (Encorpada Premium)'}
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <span className="text-zinc-400 font-medium">Tratamento</span>
                    <span className="text-white text-right font-medium">Silver-Ion Antibacterial + Peach Skin Anti-Pilling</span>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <span className="text-zinc-400 font-medium">Modelagem</span>
                    <span className="text-white text-right font-medium">Streetwear Regular Fit Estruturado</span>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <span className="text-zinc-400 font-medium">Gola & Costura</span>
                    <span className="text-white text-right font-medium">Ribana 2x1 com pesponto duplo e reforço ombro a ombro</span>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <span className="text-zinc-400 font-medium">Etiqueta</span>
                    <span className="text-white text-right font-medium">Termocolante Flat-Seam interna (Sem atrito)</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="py-2.5 flex justify-between gap-4">
                    <span className="text-zinc-400 font-medium">SKU</span>
                    <span className="text-white text-right font-mono">{product.sku}</span>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <span className="text-zinc-400 font-medium">Material Principal</span>
                    <span className="text-white text-right font-medium">{product.shortDescription || 'Liga Metálica / Alumínio Industrial'}</span>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <span className="text-zinc-400 font-medium">Peso com Embalagem</span>
                    <span className="text-white text-right font-medium">{product.weightGrams || 350}g</span>
                  </div>
                </>
              )}
              <div className="py-2.5 flex justify-between gap-4">
                <span className="text-zinc-400 font-medium">Origem & Desenvolvimento</span>
                <span className="text-white text-right font-medium">Engenharia Focus Store® — Fabricado no Brasil</span>
              </div>
            </div>
          </div>
        )}

        {/* 3. ABA CUIDADOS & LAVAGEM (CLEAN) */}
        {activeTab === 'care' && (
          <div className="max-w-3xl space-y-3 text-sm text-zinc-400">
            <p><strong className="text-white font-medium">Lavagem:</strong> Lavar na máquina em ciclo suave ou normal com água fria (máximo 30°C).</p>
            <p><strong className="text-white font-medium">Sabão e Alvejante:</strong> Usar sabão neutro. Não usar alvejantes clorados para preservar as nanopartículas anti-odor e a intensidade da cor.</p>
            <p><strong className="text-white font-medium">Secagem:</strong> Secar no varal à sombra. O tecido respirável possui secagem ultrarrápida natural.</p>
            <p><strong className="text-white font-medium">Passadoria:</strong> Praticamente dispensa o ferro graças à tecnologia Wrinkle-Free. Se desejar, passar em temperatura média pelo avesso.</p>
          </div>
        )}

        {/* 4. ABA GARANTIA & TROCAS (CLEAN) */}
        {activeTab === 'returns' && (
          <div className="max-w-3xl space-y-3 text-sm text-zinc-400">
            <p><strong className="text-white font-medium">1ª Troca Grátis:</strong> Até 30 dias corridos após o recebimento para troca de tamanho ou cor sem custo de frete na primeira solicitação.</p>
            <p><strong className="text-white font-medium">Direito de Arrependimento:</strong> Até 7 dias corridos após a entrega para devolução com reembolso integral do valor pago, conforme o Código de Defesa do Consumidor.</p>
            <p><strong className="text-white font-medium">Garantia contra Defeitos:</strong> 90 dias de cobertura integral para qualquer eventual defeito de costura ou material.</p>
            <p><strong className="text-white font-medium">Atendimento:</strong> Suporte ágil via WhatsApp ou e-mail com resposta em até 2 horas úteis.</p>
          </div>
        )}
      </div>

      {/* Modal Guia de Tamanhos */}
      {showSizeGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 relative shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Ruler size={18} className="text-[#FF6500]" />
                <h3 className="font-bold text-white text-base">Tabela de Medidas (cm)</h3>
              </div>
              <button
                onClick={() => setShowSizeGuide(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-x-auto">
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
            </div>

            <p className="text-[11px] text-zinc-500 italic">
              * Medidas aproximadas em centímetros. Em caso de dúvida entre dois tamanhos, sugerimos escolher o maior para modelagem streetwear.
            </p>

            <Button
              onClick={() => setShowSizeGuide(false)}
              fullWidth
              size="sm"
              className="bg-[#FF6500] text-white font-bold"
            >
              Entendido
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}