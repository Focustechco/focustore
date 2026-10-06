'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trash2, ShoppingBag, ArrowRight, ShieldCheck, Truck, Tag, Check } from 'lucide-react';
import { useCart, resolveProductImage } from '@/modules/cart/cart-context';
import { formatPrice } from '@/lib/utils/formatters';
import { Button } from '@/components/ui/button';

export default function CartPage() {
  const { items, removeItem, updateQuantity, clearCart, subtotal, totalItems } = useCart();
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [loadingCoupon, setLoadingCoupon] = useState(false);

  const [cep, setCep] = useState('');
  const [shippingOption, setShippingOption] = useState<any>(null);
  const [shippingOptions, setShippingOptions] = useState<any[]>([]);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;

    setLoadingCoupon(true);
    setCouponError('');

    try {
      const res = await fetch('/api/checkout/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponCode,
          subtotal,
          shippingCost: shippingOption?.price || 0,
        }),
      });
      const data = await res.json();
      if (data.valid) {
        setCouponApplied(data.coupon);
      } else {
        setCouponError(data.error || 'Cupom inválido');
        setCouponApplied(null);
      }
    } catch (err) {
      setCouponError('Erro ao validar cupom.');
    } finally {
      setLoadingCoupon(false);
    }
  };

  const handleCalculateShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cep.replace(/\D/g, '');
    if (clean.length === 8) {
      try {
        const res = await fetch('/api/shipping/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postalCode: clean, subtotal }),
        });
        const options = await res.json();
        setShippingOptions(options);
        if (options.length > 0) setShippingOption(options[0]);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const discountAmount = couponApplied?.discountAmount || 0;
  const shippingCost = couponApplied?.freeShipping ? 0 : (shippingOption?.price || 0);
  const finalTotal = Math.max(0, subtotal - discountAmount + shippingCost);

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-surface flex items-center justify-center text-muted mx-auto border border-white/5">
          <ShoppingBag size={36} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white uppercase">
          Seu carrinho está esperando por boas ideias.
        </h1>
        <p className="text-sm text-muted max-w-md mx-auto">
          Explore nossos produtos de tecnologia, design, vestuário premium e lifestyle.
        </p>
        <Link href="/categoria/todos">
          <Button size="lg" className="mt-4">
            Explorar catálogo completo →
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <div className="flex items-baseline justify-between border-b border-white/10 pb-4">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
          Seu Carrinho ({totalItems} {totalItems === 1 ? 'item' : 'itens'})
        </h1>
        <button
          onClick={clearCart}
          className="text-xs text-muted hover:text-red-400 transition-colors uppercase font-semibold"
        >
          Limpar carrinho
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Tabela de Itens (8 Cols) */}
        <div className="lg:col-span-8 divide-y divide-white/5 bg-surface/40 p-6 rounded-2xl border border-white/5">
          {items.map((item) => {
            const itemPrice = item.promotionalPrice || item.price;
            return (
              <div key={item.variantId} className="py-5 flex gap-5 items-center">
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-[#121212] rounded-xl overflow-hidden flex-shrink-0 border border-white/5">
                  <Image
                    src={resolveProductImage(item.imageUrl, item.name)}
                    alt={item.name}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>

                <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Link
                      href={`/produto/${item.productId}`}
                      className="text-sm sm:text-base font-bold text-white hover:text-focus transition-colors"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs text-muted">Variação: {item.variantName}</p>
                    <p className="text-xs text-muted">SKU: {item.sku}</p>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Controle Qtd */}
                    <div className="flex items-center border border-white/10 rounded-lg bg-[#121212]">
                      <button
                        onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                        className="px-3 py-1.5 text-xs text-muted hover:text-white"
                      >
                        -
                      </button>
                      <span className="px-3 text-xs font-bold text-white">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                        className="px-3 py-1.5 text-xs text-muted hover:text-white"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right min-w-[100px]">
                      <p className="text-sm sm:text-base font-bold text-white">
                        {formatPrice(itemPrice * item.quantity)}
                      </p>
                      {item.quantity > 1 && (
                        <p className="text-[11px] text-muted">{formatPrice(itemPrice)} un.</p>
                      )}
                    </div>

                    <button
                      onClick={() => removeItem(item.variantId)}
                      className="text-muted hover:text-red-400 p-2 transition-colors"
                      aria-label="Remover item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Resumo do Pedido (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-surface p-6 rounded-2xl border border-white/10 space-y-6 shadow-card-dark">
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              Resumo da Compra
            </h2>

            {/* Cupom */}
            <form onSubmit={handleApplyCoupon} className="space-y-2">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block">
                Cupom de Desconto
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="FOCUS10"
                    className="w-full bg-[#101010] border border-white/15 rounded-lg py-2 pl-8 pr-3 text-xs text-white uppercase focus:outline-none focus:border-focus"
                  />
                  <Tag size={14} className="absolute left-2.5 top-2.5 text-muted" />
                </div>
                <Button size="sm" variant="outline" type="submit" disabled={loadingCoupon}>
                  {loadingCoupon ? '...' : 'Aplicar'}
                </Button>
              </div>
              {couponApplied && (
                <p className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <Check size={13} /> Cupom {couponApplied.code} aplicado (-{formatPrice(couponApplied.discountAmount)})
                </p>
              )}
              {couponError && <p className="text-xs text-red-400">{couponError}</p>}
            </form>

            {/* Frete */}
            <form onSubmit={handleCalculateShipping} className="space-y-2 pt-2 border-t border-white/5">
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block">
                Calcular Frete
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={cep}
                    onChange={(e) => setCep(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    className="w-full bg-[#101010] border border-white/15 rounded-lg py-2 pl-8 pr-3 text-xs text-white focus:outline-none focus:border-focus"
                  />
                  <Truck size={14} className="absolute left-2.5 top-2.5 text-muted" />
                </div>
                <Button size="sm" variant="outline" type="submit">
                  OK
                </Button>
              </div>
              {shippingOptions.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  {shippingOptions.map((opt, i) => (
                    <label
                      key={i}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer ${
                        shippingOption?.serviceName === opt.serviceName
                          ? 'border-focus bg-focus/10 text-white'
                          : 'border-white/5 bg-[#101010] text-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="shipping"
                          checked={shippingOption?.serviceName === opt.serviceName}
                          onChange={() => setShippingOption(opt)}
                          className="accent-focus"
                        />
                        <span>{opt.carrier} ({opt.estimatedDays}d)</span>
                      </div>
                      <span className="font-bold text-white">{formatPrice(opt.price)}</span>
                    </label>
                  ))}
                </div>
              )}
            </form>

            {/* Linhas de Valores */}
            <div className="space-y-2 pt-4 border-t border-white/10 text-xs sm:text-sm">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span className="text-white font-medium">{formatPrice(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Desconto</span>
                  <span>-{formatPrice(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted">
                <span>Frete</span>
                <span className="text-white font-medium">
                  {shippingOption ? formatPrice(shippingCost) : 'A calcular'}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-white pt-3 border-t border-white/10">
                <span>Total</span>
                <span className="text-focus text-xl">{formatPrice(finalTotal)}</span>
              </div>
            </div>

            <Link href="/checkout">
              <Button fullWidth size="lg" className="mt-2 gap-2 shadow-focus/20 shadow">
                IR PARA O CHECKOUT <ArrowRight size={18} />
              </Button>
            </Link>

            <div className="space-y-1.5 pt-2 text-[11px] text-muted">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>Checkout 100% Criptografado & Seguro</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck size={14} className="text-focus" />
                <span>Rastreamento em tempo real por WhatsApp e E-mail</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}