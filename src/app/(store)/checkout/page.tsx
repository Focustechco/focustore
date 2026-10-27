'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Truck,
  CreditCard,
  QrCode,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShoppingBag
} from 'lucide-react';
import { useCart } from '@/modules/cart/cart-context';
import { formatPrice } from '@/lib/utils/formatters';
import { Button } from '@/components/ui/button';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();

  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. Identificação
  const [customer, setCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
  });

  // 2. Endereço
  const [address, setAddress] = useState({
    postalCode: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: 'São Paulo',
    state: 'SP',
  });

  // 3. Frete
  const [shippingOption, setShippingOption] = useState({
    carrier: 'Focus Express',
    serviceName: 'SEDEX Express',
    price: 18.50,
    estimatedDays: 2,
  });

  // 4. Pagamento
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
  const [card, setCard] = useState({
    number: '',
    holder: '',
    expiry: '',
    cvv: '',
    installments: 1,
  });

  // Idempotency key única para este checkout
  const [idempotencyKey, setIdempotencyKey] = useState('');

  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, []);

  const total = subtotal + shippingOption.price;

  const handleCepLookup = async (cepValue: string) => {
    const clean = cepValue.replace(/\D/g, '');
    if (clean.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setAddress((prev) => ({
            ...prev,
            street: data.logradouro || prev.street,
            neighborhood: data.bairro || prev.neighborhood,
            city: data.localidade || prev.city,
            state: data.uf || prev.state,
          }));
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleFinishOrder = async () => {
    setLoading(true);
    setError('');

    try {
      const payload = {
        customer,
        shippingAddress: address,
        shippingOption,
        paymentMethod,
        cardDetails: paymentMethod === 'CREDIT_CARD' ? {
          number: card.number.slice(-4), // Apenas 4 últimos dígitos
          holder: card.holder,
          expiry: card.expiry,
          installments: Number(card.installments),
        } : undefined,
        items: items.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
        })),
        idempotencyKey,
      };

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao processar checkout');
      }

      clearCart();
      router.push(`/checkout/confirmacao/${data.order.id}`);
    } catch (err: any) {
      setError(err.message || 'Falha ao concluir pedido.');
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <ShoppingBag size={40} className="mx-auto text-muted" />
        <h1 className="text-xl font-bold text-white uppercase">Seu carrinho está vazio</h1>
        <Link href="/categoria/todos">
          <Button size="sm">Explorar Catálogo</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="border-b border-white/10 pb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Finalizar Compra
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Formulário de Etapas (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* ETAPA 1: IDENTIFICAÇÃO */}
          <div className="bg-surface p-6 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-focus text-white text-xs flex items-center justify-center font-bold">1</span>
                Dados de Identificação
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-muted">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome e Sobrenome"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  className="w-full bg-[#101010] border border-white/15 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-focus"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted">E-mail *</label>
                <input
                  type="email"
                  required
                  placeholder="seu@email.com"
                  value={customer.email}
                  onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                  className="w-full bg-[#101010] border border-white/15 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-focus"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted">WhatsApp / Telefone *</label>
                <input
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={customer.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  className="w-full bg-[#101010] border border-white/15 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-focus"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted">CPF *</label>
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={customer.cpf}
                  onChange={(e) => setCustomer({ ...customer, cpf: e.target.value })}
                  className="w-full bg-[#101010] border border-white/15 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-focus"
                />
              </div>
            </div>
          </div>

          {/* ETAPA 2: ENDEREÇO DE ENTREGA */}
          <div className="bg-surface p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-focus text-white text-xs flex items-center justify-center font-bold">2</span>
              Endereço de Entrega
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1 sm:col-span-1">
                <label className="text-xs text-muted">CEP *</label>
                <input
                  type="text"
                  placeholder="00000-000"
                  maxLength={9}
                  value={address.postalCode}
                  onChange={(e) => {
                    setAddress({ ...address, postalCode: e.target.value });
                    handleCepLookup(e.target.value);
                  }}
                  className="w-full bg-[#101010] border border-white/15 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-focus"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted">Rua / Avenida *</label>
                <input
                  type="text"
                  placeholder="Nome da rua"
                  value={address.street}
                  onChange={(e) => setAddress({ ...address, street: e.target.value })}
                  className="w-full bg-[#101010] border border-white/15 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-focus"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted">Número *</label>
                <input
                  type="text"
                  placeholder="123"
                  value={address.number}
                  onChange={(e) => setAddress({ ...address, number: e.target.value })}
                  className="w-full bg-[#101010] border border-white/15 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-focus"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted">Complemento</label>
                <input
                  type="text"
                  placeholder="Apto, Bloco (Opcional)"
                  value={address.complement}
                  onChange={(e) => setAddress({ ...address, complement: e.target.value })}
                  className="w-full bg-[#101010] border border-white/15 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-focus"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted">Bairro *</label>
                <input
                  type="text"
                  placeholder="Bairro"
                  value={address.neighborhood}
                  onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
                  className="w-full bg-[#101010] border border-white/15 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-focus"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted">Cidade *</label>
                <input
                  type="text"
                  value={address.city}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  className="w-full bg-[#101010] border border-white/15 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-focus"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted">Estado *</label>
                <input
                  type="text"
                  maxLength={2}
                  value={address.state}
                  onChange={(e) => setAddress({ ...address, state: e.target.value.toUpperCase() })}
                  className="w-full bg-[#101010] border border-white/15 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-focus"
                />
              </div>
            </div>
          </div>

          {/* ETAPA 3: FORMA DE PAGAMENTO */}
          <div className="bg-surface p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-focus text-white text-xs flex items-center justify-center font-bold">3</span>
              Forma de Pagamento
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('PIX')}
                className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                  paymentMethod === 'PIX'
                    ? 'border-focus bg-focus/10 text-white shadow-focus/20 shadow'
                    : 'border-white/10 bg-[#101010] text-muted hover:text-white'
                }`}
              >
                <QrCode size={24} className={paymentMethod === 'PIX' ? 'text-focus' : 'text-muted'} />
                <span className="text-xs font-bold uppercase tracking-wider">PIX (5% OFF)</span>
                <span className="text-[10px] text-emerald-400">Aprovação Imediata</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('CREDIT_CARD')}
                className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${
                  paymentMethod === 'CREDIT_CARD'
                    ? 'border-focus bg-focus/10 text-white shadow-focus/20 shadow'
                    : 'border-white/10 bg-[#101010] text-muted hover:text-white'
                }`}
              >
                <CreditCard size={24} className={paymentMethod === 'CREDIT_CARD' ? 'text-focus' : 'text-muted'} />
                <span className="text-xs font-bold uppercase tracking-wider">Cartão de Crédito</span>
                <span className="text-[10px] text-muted">Até 12x sem juros</span>
              </button>
            </div>

            {paymentMethod === 'PIX' ? (
              <div className="p-4 rounded-xl bg-[#101010] border border-white/5 text-xs text-muted space-y-2">
                <p className="text-white font-semibold">Como funciona o pagamento via PIX:</p>
                <p>1. Ao confirmar seu pedido, você receberá o QR Code e o código Pix Copia e Cola.</p>
                <p>2. Abra o aplicativo do seu banco e pague instantaneamente.</p>
                <p>3. A confirmação é automática em poucos segundos e seu pedido entra em separação.</p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#101010] border border-white/5 space-y-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted">Número do Cartão</label>
                  <input
                    type="text"
                    placeholder="4000 0000 0000 0000"
                    maxLength={19}
                    value={card.number}
                    onChange={(e) => setCard({ ...card, number: e.target.value })}
                    className="w-full bg-[#151515] border border-white/15 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-focus"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted">Nome Impresso no Cartão</label>
                  <input
                    type="text"
                    placeholder="NOME COMO NO CARTÃO"
                    value={card.holder}
                    onChange={(e) => setCard({ ...card, holder: e.target.value.toUpperCase() })}
                    className="w-full bg-[#151515] border border-white/15 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-focus"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted">Validade (MM/AA)</label>
                    <input
                      type="text"
                      placeholder="12/28"
                      maxLength={5}
                      value={card.expiry}
                      onChange={(e) => setCard({ ...card, expiry: e.target.value })}
                      className="w-full bg-[#151515] border border-white/15 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-focus"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted">CVV</label>
                    <input
                      type="password"
                      placeholder="123"
                      maxLength={4}
                      value={card.cvv}
                      onChange={(e) => setCard({ ...card, cvv: e.target.value })}
                      className="w-full bg-[#151515] border border-white/15 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-focus"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted">Parcelamento</label>
                  <select
                    value={card.installments}
                    onChange={(e) => setCard({ ...card, installments: Number(e.target.value) })}
                    className="w-full bg-[#151515] border border-white/15 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-focus"
                  >
                    {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                      <option key={n} value={n}>
                        {n}x de {formatPrice(total / n)} sem juros
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resumo Lateral (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-surface p-6 rounded-2xl border border-white/10 space-y-6 shadow-card-dark">
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              Itens do Pedido ({items.length})
            </h2>

            <div className="divide-y divide-white/5 max-h-72 overflow-y-auto pr-2 space-y-3">
              {items.map((item) => (
                <div key={item.variantId} className="pt-3 flex gap-3 items-center">
                  <div className="relative w-14 h-14 bg-[#121212] rounded-lg overflow-hidden flex-shrink-0 border border-white/5">
                    <Image
                      src={item.imageUrl || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80'}
                      alt={item.name}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 text-xs">
                    <p className="font-semibold text-white line-clamp-1">{item.name}</p>
                    <p className="text-muted text-[11px]">{item.variantName}</p>
                    <p className="text-muted text-[11px]">Qtd: {item.quantity}</p>
                  </div>
                  <span className="text-xs font-bold text-white">
                    {formatPrice((item.promotionalPrice || item.price) * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-4 border-t border-white/10 text-xs">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span className="text-white font-medium">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Frete ({shippingOption.serviceName})</span>
                <span className="text-white font-medium">{formatPrice(shippingOption.price)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-white/10">
                <span>Total a Pagar</span>
                <span className="text-focus text-xl">{formatPrice(total)}</span>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
                {error}
              </div>
            )}

            <Button
              onClick={handleFinishOrder}
              disabled={loading || !customer.name || !customer.email || !address.street}
              fullWidth
              size="lg"
              className="gap-2 shadow-focus/30 shadow-md font-bold uppercase tracking-wider"
            >
              {loading ? 'Processando Pedido...' : 'CONCLUIR PEDIDO'} <ArrowRight size={18} />
            </Button>

            <p className="text-[11px] text-muted text-center">
              Ao clicar em concluir, você concorda com nossos termos de serviço e política de privacidade.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}