'use client';

import React, { useState } from 'react';
import {
  Settings,
  Store,
  CreditCard,
  Truck,
  Shield,
  Bell,
  Save,
  Check,
  Globe,
  Mail,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminSettingsPage() {
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({
    storeName: 'FOCUS STORE®',
    tagline: 'TECHWEAR & LIFESTYLE',
    supportEmail: 'contato@focus.store',
    supportPhone: '+55 (11) 99999-9999',
    instagramHandle: '@focus.store',
    currency: 'BRL (R$)',
    freeShippingThreshold: '299.00',
    pixDiscountPercent: '10',
    maxInstallments: '12',
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
            Configurações da Loja
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Parâmetros globais do e-commerce, dados de contato e regras comerciais.
          </p>
        </div>

        {saved && (
          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
            <Check size={14} /> Configurações salvas!
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Identidade da Marca */}
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-3">
            <Store size={16} className="text-[#FF6500]" />
            <span>Identidade do E-commerce</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-zinc-400 font-semibold uppercase tracking-wider block">
                Nome da Loja
              </label>
              <input
                type="text"
                value={formData.storeName}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                className="w-full bg-[#141414] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-400 font-semibold uppercase tracking-wider block">
                Slogan / Tagline
              </label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full bg-[#141414] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none"
              />
            </div>
          </div>
        </div>

        {/* Canais de Atendimento */}
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-3">
            <Phone size={16} className="text-[#FF6500]" />
            <span>Canais de Atendimento & Redes</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-zinc-400 font-semibold uppercase tracking-wider block">
                E-mail de Suporte
              </label>
              <input
                type="email"
                value={formData.supportEmail}
                onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
                className="w-full bg-[#141414] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-400 font-semibold uppercase tracking-wider block">
                WhatsApp / SAC
              </label>
              <input
                type="text"
                value={formData.supportPhone}
                onChange={(e) => setFormData({ ...formData, supportPhone: e.target.value })}
                className="w-full bg-[#141414] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-400 font-semibold uppercase tracking-wider block">
                Instagram Oficial
              </label>
              <input
                type="text"
                value={formData.instagramHandle}
                onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                className="w-full bg-[#141414] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none"
              />
            </div>
          </div>
        </div>

        {/* Regras Comerciais & Pagamentos */}
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-3">
            <CreditCard size={16} className="text-[#FF6500]" />
            <span>Regras Comerciais & Pagamentos</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-zinc-400 font-semibold uppercase tracking-wider block">
                Desconto PIX (%)
              </label>
              <input
                type="number"
                value={formData.pixDiscountPercent}
                onChange={(e) => setFormData({ ...formData, pixDiscountPercent: e.target.value })}
                className="w-full bg-[#141414] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-400 font-semibold uppercase tracking-wider block">
                Frete Grátis a partir de (R$)
              </label>
              <input
                type="number"
                value={formData.freeShippingThreshold}
                onChange={(e) => setFormData({ ...formData, freeShippingThreshold: e.target.value })}
                className="w-full bg-[#141414] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-400 font-semibold uppercase tracking-wider block">
                Máximo de Parcelas (Cartão)
              </label>
              <input
                type="number"
                value={formData.maxInstallments}
                onChange={(e) => setFormData({ ...formData, maxInstallments: e.target.value })}
                className="w-full bg-[#141414] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none"
              />
            </div>
          </div>
        </div>

        {/* Botão Salvar */}
        <div className="flex items-center justify-end pt-2">
          <Button
            type="submit"
            className="gap-2 bg-[#FF6500] hover:bg-[#FF7A1A] text-white font-bold uppercase tracking-wider px-6 py-2.5 rounded-xl shadow-lg shadow-[#FF6500]/20"
          >
            <Save size={16} /> Salvar Configurações
          </Button>
        </div>
      </form>
    </div>
  );
}
