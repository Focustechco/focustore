'use client';

import React, { useEffect, useState } from 'react';
import {
  Store,
  CreditCard,
  Save,
  Check,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SettingsFormData {
  storeName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  instagramHandle: string;
  freeShippingThreshold: string;
  pixDiscountPercent: string;
  maxInstallments: string;
}

const DEFAULT_SETTINGS: SettingsFormData = {
  storeName: 'FOCUS STORE®',
  tagline: 'TECHWEAR & LIFESTYLE',
  supportEmail: 'contato@focus.store',
  supportPhone: '+55 (11) 99999-9999',
  instagramHandle: '@focus.store',
  freeShippingThreshold: '299.00',
  pixDiscountPercent: '10',
  maxInstallments: '12',
};

export default function AdminSettingsPage() {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<SettingsFormData>(DEFAULT_SETTINGS);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/admin/settings');
        const data = (await response.json()) as {
          settings?: Partial<SettingsFormData>;
          error?: string;
        };
        if (!response.ok || !data.settings) {
          throw new Error(data.error || 'Não foi possível carregar as configurações.');
        }
        setFormData({ ...DEFAULT_SETTINGS, ...data.settings });
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Não foi possível carregar as configurações.',
        );
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
  }, []);

  const updateField = (field: keyof SettingsFormData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setSaved(false);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = (await response.json()) as {
        settings?: SettingsFormData;
        error?: string;
      };
      if (!response.ok || !data.settings) {
        throw new Error(data.error || 'Não foi possível salvar as configurações.');
      }
      setFormData(data.settings);
      setSaved(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Não foi possível salvar as configurações.',
      );
    } finally {
      setSaving(false);
    }
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

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </p>
      )}

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
                required
                value={formData.storeName}
                maxLength={80}
                onChange={(e) => updateField('storeName', e.target.value)}
                disabled={loading || saving}
                className="w-full bg-[#141414] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-400 font-semibold uppercase tracking-wider block">
                Slogan / Tagline
              </label>
              <input
                type="text"
                maxLength={120}
                value={formData.tagline}
                onChange={(e) => updateField('tagline', e.target.value)}
                disabled={loading || saving}
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
                required
                value={formData.supportEmail}
                onChange={(e) => updateField('supportEmail', e.target.value)}
                disabled={loading || saving}
                className="w-full bg-[#141414] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-400 font-semibold uppercase tracking-wider block">
                WhatsApp / SAC
              </label>
              <input
                type="text"
                required
                maxLength={40}
                value={formData.supportPhone}
                onChange={(e) => updateField('supportPhone', e.target.value)}
                disabled={loading || saving}
                className="w-full bg-[#141414] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-400 font-semibold uppercase tracking-wider block">
                Instagram Oficial
              </label>
              <input
                type="text"
                maxLength={60}
                value={formData.instagramHandle}
                onChange={(e) => updateField('instagramHandle', e.target.value)}
                disabled={loading || saving}
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
                min={0}
                max={100}
                step={1}
                required
                value={formData.pixDiscountPercent}
                onChange={(e) => updateField('pixDiscountPercent', e.target.value)}
                disabled={loading || saving}
                className="w-full bg-[#141414] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-400 font-semibold uppercase tracking-wider block">
                Frete Grátis a partir de (R$)
              </label>
              <input
                type="number"
                min={0}
                max={100000}
                step="0.01"
                required
                value={formData.freeShippingThreshold}
                onChange={(e) => updateField('freeShippingThreshold', e.target.value)}
                disabled={loading || saving}
                className="w-full bg-[#141414] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-400 font-semibold uppercase tracking-wider block">
                Máximo de Parcelas (Cartão)
              </label>
              <input
                type="number"
                min={1}
                max={24}
                step={1}
                required
                value={formData.maxInstallments}
                onChange={(e) => updateField('maxInstallments', e.target.value)}
                disabled={loading || saving}
                className="w-full bg-[#141414] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none"
              />
            </div>
          </div>
        </div>

        {/* Botão Salvar */}
        <div className="flex items-center justify-end pt-2">
          <Button
            type="submit"
            disabled={loading || saving}
            className="gap-2 bg-[#FF6500] hover:bg-[#FF7A1A] text-white font-bold uppercase tracking-wider px-6 py-2.5 rounded-xl shadow-lg shadow-[#FF6500]/20"
          >
            <Save size={16} /> {saving ? 'Salvando...' : loading ? 'Carregando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </form>
    </div>
  );
}
