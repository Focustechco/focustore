'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { X, Trash2, ShoppingCart, ArrowRight, ShieldCheck, Plus, Minus } from 'lucide-react';
import { useCart, resolveProductImage } from '@/modules/cart/cart-context';
import { formatPrice } from '@/lib/utils/formatters';
import { Button } from '../ui/button';

export function CartDrawer() {
  const { items, isCartOpen, setIsCartOpen, removeItem, updateQuantity, subtotal, totalItems } = useCart();

  // Bloqueia scroll da pagina quando o carrinho estiver aberto
  useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isCartOpen]);

  return (
    <div
      className={`fixed inset-0 z-50 transition-all duration-300 ${
        isCartOpen ? 'pointer-events-auto visible' : 'pointer-events-none invisible'
      }`}
    >
      {/* Backdrop suave e fluido com blur */}
      <div
        className={`absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity duration-300 ease-out ${
          isCartOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={() => setIsCartOpen(false)}
      />

      {/* Drawer deslizante com curva de aceleracao suave estilo iOS/macOS */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div
          className={`w-screen max-w-md bg-[#0D0D0D] border-l border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col transform transition-transform duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            isCartOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header do Carrinho */}
          <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-[#121212]">
            <div className="flex items-center gap-2.5">
              <ShoppingCart className="text-[#FF6500]" size={20} />
              <h2 className="text-sm font-bold text-white tracking-wider uppercase">
                Seu Carrinho
              </h2>
              {totalItems > 0 && (
                <span className="bg-[#FF6500]/20 text-[#FF6500] border border-[#FF6500]/40 text-xs font-black px-2 py-0.5 rounded-full">
                  {totalItems} {totalItems === 1 ? 'item' : 'itens'}
                </span>
              )}
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="text-zinc-400 hover:text-white hover:bg-white/10 transition-all p-1.5 rounded-full focus:outline-none"
              aria-label="Fechar carrinho"
            >
              <X size={18} />
            </button>
          </div>

          {/* Lista de Itens com Scroll Suave */}
          <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-white/5 space-y-1">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <div className="w-16 h-16 rounded-full bg-[#181818] flex items-center justify-center text-zinc-500 mb-4 border border-white/5">
                  <ShoppingCart size={28} />
                </div>
                <h3 className="text-white font-bold text-sm mb-1 uppercase tracking-wide">
                  Seu carrinho está vazio
                </h3>
                <p className="text-xs text-zinc-400 max-w-xs mb-6 leading-relaxed">
                  Adicione produtos exclusivos da Focus Store para aproveitar frete inteligente e cupons de desconto.
                </p>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="px-5 py-2.5 rounded-full bg-[#FF6500] hover:bg-[#FF7A1A] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-[#FF6500]/20"
                >
                  Explorar catálogo
                </button>
              </div>
            ) : (
              items.map((item) => {
                const itemPrice = item.promotionalPrice || item.price;
                const itemImage = resolveProductImage(item.imageUrl, item.name);
                return (
                  <div key={item.variantId} className="py-3.5 flex gap-3.5 items-center group">
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 bg-[#161616] rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
                      <Image
                        src={itemImage}
                        alt={item.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight truncate">
                          {item.name}
                        </h4>
                        <button
                          onClick={() => removeItem(item.variantId)}
                          className="text-zinc-500 hover:text-red-400 p-1 transition-colors rounded"
                          title="Remover item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {item.variantName}
                      </p>

                      <div className="flex items-center justify-between mt-3">
                        {/* Controles de Quantidade */}
                        <div className="flex items-center border border-white/10 rounded-lg bg-[#181818] overflow-hidden">
                          <button
                            onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                            className="px-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="px-2.5 text-xs font-bold text-white min-w-[20px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                            className="px-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        {/* Preço */}
                        <span className="text-xs font-black text-[#FF6500]">
                          {formatPrice(itemPrice * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Rodapé / Subtotal & Checkout */}
          {items.length > 0 && (
            <div className="p-6 border-t border-white/10 bg-[#121212] space-y-4">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Subtotal</span>
                  <span className="font-semibold text-white">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Frete</span>
                  <span className="text-emerald-400 font-medium">Calculado no checkout</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-white/10">
                  <span>Total estimado</span>
                  <span className="text-base text-[#FF6500] font-black">{formatPrice(subtotal)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Link
                  href="/checkout"
                  onClick={() => setIsCartOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#FF6500] hover:bg-[#FF7A1A] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#FF6500]/25 hover:scale-[1.01]"
                >
                  <span>Finalizar Compra</span>
                  <ArrowRight size={16} />
                </Link>

                <button
                  onClick={() => setIsCartOpen(false)}
                  className="w-full py-2 text-center text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Continuar comprando
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500 pt-1">
                <ShieldCheck size={13} className="text-emerald-400" />
                <span>Checkout 100% Seguro & Criptografado</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}