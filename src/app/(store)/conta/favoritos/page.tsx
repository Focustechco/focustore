'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, ShoppingBag, Trash2, ArrowLeft, ArrowRight, Sparkles, ChevronRight } from 'lucide-react';
import { useFavorites } from '@/modules/favorites/favorites-context';
import { useCart } from '@/modules/cart/cart-context';
import { formatPrice } from '@/lib/utils/formatters';
import { Button } from '@/components/ui/button';

export default function FavoritosPage() {
  const { favorites, removeFavorite, clearFavorites, totalFavorites } = useFavorites();
  const { addItem, setIsCartOpen } = useCart();

  const handleAddToCart = (product: any) => {
    const defaultVariant = product.variants?.[0];
    addItem({
      variantId: defaultVariant?.id || product.id,
      productId: product.id,
      name: product.name,
      variantName: defaultVariant?.name || 'Padrão',
      price: defaultVariant?.price || product.basePrice,
      promotionalPrice: defaultVariant?.promotionalPrice || product.promotionalPrice,
      imageUrl: product.imageUrl,
      sku: defaultVariant?.sku || 'FS-FAV',
      quantity: 1,
      size: defaultVariant?.size || 'Único',
      color: defaultVariant?.color || 'Padrão',
    });
    setIsCartOpen(true);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8 select-none">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
        <Link href="/" className="hover:text-white transition-colors">Início</Link>
        <ChevronRight size={14} className="text-zinc-600" />
        <Link href="/conta" className="hover:text-white transition-colors">Minha Conta</Link>
        <ChevronRight size={14} className="text-zinc-600" />
        <span className="text-white font-bold">Meus Favoritos</span>
      </nav>

      {/* Header da Página */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-white/10">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
            Meus Produtos Favoritos
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            {totalFavorites === 0
              ? 'Nenhum item salvo no momento.'
              : `Você tem ${totalFavorites} ${totalFavorites === 1 ? 'item salvo' : 'itens salvos'} na sua lista de desejos.`}
          </p>
        </div>

        {totalFavorites > 0 && (
          <button
            onClick={clearFavorites}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-red-400 transition-colors cursor-pointer self-start sm:self-auto py-1"
          >
            <Trash2 size={14} />
            <span>Limpar lista de favoritos</span>
          </button>
        )}
      </div>

      {/* Estado Vazio */}
      {totalFavorites === 0 ? (
        <div className="py-16 sm:py-24 text-center rounded-2xl bg-[#0F0F0F] border border-white/10 max-w-2xl mx-auto space-y-6 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-radial from-[#FF6500]/10 via-transparent to-transparent pointer-events-none" />

          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-[#181818] border border-white/10 flex items-center justify-center text-zinc-500 shadow-xl shadow-black/50 relative z-10">
            <Heart size={32} className="text-[#FF6500]/60 stroke-[1.5]" />
          </div>

          <div className="space-y-2 relative z-10">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Sua lista de favoritos está vazia
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
              Explore o catálogo da Focus Store e clique no ícone de coração nos itens que você mais gostar para salvá-los e acompanhar preços e novidades.
            </p>
          </div>

          <div className="pt-2 relative z-10">
            <Link href="/categoria/todos">
              <Button size="lg" className="bg-[#FF6500] hover:bg-[#FF6500]/90 text-white font-bold px-8 shadow-lg shadow-[#FF6500]/30 text-xs uppercase tracking-wider">
                Explorar Catálogo <ArrowRight size={14} />
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        /* Grid de Produtos Favoritados */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {favorites.map((product) => {
            const price = product.promotionalPrice || product.basePrice;
            const hasDiscount = product.promotionalPrice && product.promotionalPrice < product.basePrice;

            return (
              <div
                key={product.id || product.slug}
                className="group relative flex flex-col bg-[#0F0F0F] rounded-2xl overflow-hidden border border-white/10 hover:border-[#FF6500]/50 transition-all duration-300 hover:shadow-[0_15px_30px_rgba(0,0,0,0.8)] hover:-translate-y-1 h-full justify-between"
              >
                {/* Imagem do Produto com Glow e Botão de Remover */}
                <div className="relative aspect-square w-full bg-[#0F0F0F] overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 bg-radial from-[#FF6500]/15 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10" />

                  {/* Botão Remover dos Favoritos */}
                  <button
                    onClick={() => removeFavorite(product.id)}
                    className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/60 backdrop-blur-md text-[#FF6500] hover:text-white hover:bg-red-600 transition-all focus:outline-none cursor-pointer shadow-lg"
                    title="Remover dos favoritos"
                  >
                    <Trash2 size={14} />
                  </button>

                  <Link href={`/produto/${product.slug}`} className="relative w-full h-full block">
                    <Image
                      src={product.imageUrl || '/images/products/camiseta-focus.jpg'}
                      alt={product.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  </Link>
                </div>

                {/* Conteúdo & Ações */}
                <div className="p-4 sm:p-5 flex flex-col flex-1 justify-between gap-3 bg-[#0F0F0F]">
                  <div className="space-y-1.5">
                    <p className="text-[10px] sm:text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      {product.categories?.[0]?.category?.name || 'FOCUS STORE'}
                    </p>
                    <Link href={`/produto/${product.slug}`}>
                      <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-[#FF6500] transition-colors line-clamp-2 leading-snug">
                        {product.name}
                      </h3>
                    </Link>
                  </div>

                  <div className="space-y-3 pt-1 border-t border-white/5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm sm:text-base font-black text-white">
                        {formatPrice(price)}
                      </span>
                      {hasDiscount && (
                        <span className="text-[11px] text-zinc-500 line-through">
                          {formatPrice(product.basePrice)}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Link href={`/produto/${product.slug}`} className="w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          fullWidth
                          className="text-[11px] font-bold border-white/10 hover:border-white/30 h-8.5"
                        >
                          Detalhes
                        </Button>
                      </Link>

                      <Button
                        onClick={() => handleAddToCart(product)}
                        size="sm"
                        fullWidth
                        className="bg-[#FF6500] hover:bg-[#FF6500]/90 text-white font-bold text-[11px] h-8.5 shadow-md shadow-[#FF6500]/20 gap-1"
                      >
                        <ShoppingBag size={12} />
                        <span>Comprar</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
