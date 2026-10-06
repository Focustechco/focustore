'use client';

import React, { useState, useEffect } from 'react';
import {
  Ticket,
  Plus,
  Search,
  Filter,
  Percent,
  DollarSign,
  Truck,
  Calendar,
  Layers,
  Copy,
  Check,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  TrendingUp,
  AlertCircle,
  X,
  Clock,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/utils/formatters';

interface Coupon {
  id: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  discountValue: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  _count?: { usages: number };
  usages?: any[];
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    code: '',
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING',
    discountValue: 10,
    minOrderAmount: '',
    maxDiscount: '',
    usageLimit: '',
    isActive: true,
    startsAt: '',
    expiresAt: '',
  });

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/coupons');
      const data = await res.json();
      if (data.success) {
        setCoupons(data.coupons);
      }
    } catch (err) {
      console.error('Erro ao carregar cupons:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const openCreateModal = () => {
    setEditingCoupon(null);
    setFormData({
      code: '',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderAmount: '',
      maxDiscount: '',
      usageLimit: '100',
      isActive: true,
      startsAt: '',
      expiresAt: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderAmount: coupon.minOrderAmount ? String(coupon.minOrderAmount) : '',
      maxDiscount: coupon.maxDiscount ? String(coupon.maxDiscount) : '',
      usageLimit: coupon.usageLimit ? String(coupon.usageLimit) : '',
      isActive: coupon.isActive,
      startsAt: coupon.startsAt ? coupon.startsAt.split('T')[0] : '',
      expiresAt: coupon.expiresAt ? coupon.expiresAt.split('T')[0] : '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCoupon(null);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      setMessage({ type: 'error', text: 'Informe o código do cupom.' });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        code: formData.code.toUpperCase().trim(),
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue) || 0,
        minOrderAmount: formData.minOrderAmount ? Number(formData.minOrderAmount) : null,
        maxDiscount: formData.maxDiscount ? Number(formData.maxDiscount) : null,
        usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null,
        isActive: formData.isActive,
        startsAt: formData.startsAt ? new Date(formData.startsAt).toISOString() : null,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
      };

      const url = editingCoupon
        ? `/api/admin/coupons/${editingCoupon.id}`
        : '/api/admin/coupons';
      const method = editingCoupon ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({
          type: 'success',
          text: editingCoupon
            ? `Cupom ${payload.code} atualizado com sucesso!`
            : `Cupom ${payload.code} criado e habilitado na loja!`,
        });
        closeModal();
        fetchCoupons();
        setTimeout(() => setMessage(null), 4000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao salvar cupom.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro de conexão.' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (coupon: Coupon) => {
    try {
      const updatedStatus = !coupon.isActive;
      // Optimistic update
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, isActive: updatedStatus } : c))
      );

      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: updatedStatus }),
      });

      const data = await res.json();
      if (!data.success) {
        fetchCoupons();
      }
    } catch (err) {
      fetchCoupons();
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Deseja realmente excluir o cupom "${code}"?`)) return;
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Cupom ${code} excluído com sucesso.` });
        fetchCoupons();
        setTimeout(() => setMessage(null), 4000);
      } else {
        alert(data.error || 'Erro ao excluir.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Quick suggestions
  const setQuickCode = (presetCode: string, type: any, value: number) => {
    setFormData((prev) => ({
      ...prev,
      code: presetCode,
      discountType: type,
      discountValue: value,
    }));
  };

  // Calculations for stats
  const totalCoupons = coupons.length;
  const activeCoupons = coupons.filter((c) => c.isActive).length;
  const totalUsages = coupons.reduce((acc, c) => acc + (c.usageCount || 0), 0);

  const filteredCoupons = coupons.filter((c) => {
    const matchesSearch =
      search === '' || c.code.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && c.isActive) ||
      (statusFilter === 'INACTIVE' && !c.isActive);

    const matchesType =
      typeFilter === 'ALL' || c.discountType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
            Gestão de Cupons & Descontos
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Crie campanhas promocionais, cupons de primeira compra, descontos em porcentagem e frete grátis.
          </p>
        </div>

        <Button onClick={openCreateModal} className="gap-2 bg-[#FF6500] hover:bg-[#FF7A1A] text-white font-bold uppercase tracking-wider">
          <Plus size={16} /> Novo Cupom
        </Button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
              Total de Cupons
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{totalCoupons}</span>
              <span className="text-xs text-emerald-400 font-mono font-bold">
                ({activeCoupons} ativos)
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#FF6500]">
            <Ticket size={22} />
          </div>
        </div>

        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
              Cupons Ativos
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-400">{activeCoupons}</span>
              <span className="text-xs text-zinc-500 font-mono">habilitados no checkout</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Zap size={22} />
          </div>
        </div>

        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
              Total de Utilizações
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#FF6500]">{totalUsages}</span>
              <span className="text-xs text-zinc-500 font-mono">pedidos com desconto</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#FF6500]/10 border border-[#FF6500]/20 flex items-center justify-center text-[#FF6500]">
            <TrendingUp size={22} />
          </div>
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código (ex: FOCUS10)..."
            className="w-full bg-[#101010] border border-white/10 focus:border-[#FF6500] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white uppercase outline-none font-mono"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-[#101010] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
          >
            <option value="ALL">Todos os Status</option>
            <option value="ACTIVE">Apenas Ativos</option>
            <option value="INACTIVE">Apenas Inativos</option>
          </select>
        </div>

        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full bg-[#101010] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
          >
            <option value="ALL">Todos os Tipos</option>
            <option value="PERCENTAGE">Porcentagem (%)</option>
            <option value="FIXED_AMOUNT">Valor Fixo (R$)</option>
            <option value="FREE_SHIPPING">Frete Grátis</option>
          </select>
        </div>
      </div>

      {/* Coupons List / Table */}
      {loading ? (
        <div className="flex items-center justify-center p-16 text-zinc-500 text-xs animate-pulse">
          Carregando cupons promocionais...
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-12 text-center space-y-4">
          <Ticket size={32} className="text-zinc-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white uppercase">Nenhum cupom encontrado</h3>
            <p className="text-xs text-zinc-400">
              Crie o primeiro cupom de desconto para os clientes utilizarem no carrinho.
            </p>
          </div>
          <Button onClick={openCreateModal} size="sm" className="gap-2">
            <Plus size={14} /> Criar Cupom de Desconto
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCoupons.map((coupon) => {
            const isExpired = coupon.expiresAt && new Date() > new Date(coupon.expiresAt);
            const isLimitReached = coupon.usageLimit && coupon.usageCount >= coupon.usageLimit;

            return (
              <div
                key={coupon.id}
                className={`group bg-[#0D0D0D] rounded-2xl border transition-all duration-300 p-5 flex flex-col justify-between space-y-4 relative overflow-hidden ${
                  coupon.isActive && !isExpired
                    ? 'border-white/10 hover:border-[#FF6500]/40 shadow-xl'
                    : 'border-white/5 opacity-65'
                }`}
              >
                {/* Top Badge & Discount Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm sm:text-base font-black text-white px-3 py-1 rounded-xl bg-black border border-white/15 tracking-wider inline-flex items-center gap-2 group-hover:border-[#FF6500]/50 transition-colors">
                        {coupon.code}
                        <button
                          onClick={() => handleCopyCode(coupon.code)}
                          className="text-zinc-400 hover:text-white transition-colors"
                          title="Copiar código"
                        >
                          {copiedCode === coupon.code ? (
                            <Check size={14} className="text-emerald-400" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <span
                        className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-md inline-flex items-center gap-1 ${
                          coupon.discountType === 'PERCENTAGE'
                            ? 'bg-[#FF6500]/15 text-[#FF6500] border border-[#FF6500]/30'
                            : coupon.discountType === 'FIXED_AMOUNT'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                        }`}
                      >
                        {coupon.discountType === 'PERCENTAGE' && (
                          <>
                            <Percent size={12} /> {coupon.discountValue}% OFF
                          </>
                        )}
                        {coupon.discountType === 'FIXED_AMOUNT' && (
                          <>
                            <DollarSign size={12} /> R$ {coupon.discountValue.toFixed(2)} OFF
                          </>
                        )}
                        {coupon.discountType === 'FREE_SHIPPING' && (
                          <>
                            <Truck size={12} /> Frete Grátis
                          </>
                        )}
                      </span>

                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                          coupon.isActive && !isExpired
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {isExpired ? 'Expirado' : coupon.isActive ? 'Ativo' : 'Pausado'}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Active Button */}
                  <button
                    onClick={() => handleToggleActive(coupon)}
                    className={`p-2 rounded-xl border transition-colors ${
                      coupon.isActive
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-zinc-800 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                    title={coupon.isActive ? 'Desativar cupom' : 'Ativar cupom'}
                  >
                    {coupon.isActive ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>

                {/* Details & Rules */}
                <div className="space-y-2 text-xs text-zinc-400 bg-[#141414] p-3.5 rounded-xl border border-white/5">
                  {coupon.minOrderAmount && (
                    <div className="flex items-center justify-between">
                      <span>Pedido Mínimo:</span>
                      <span className="font-semibold text-white font-mono">
                        {formatPrice(coupon.minOrderAmount)}
                      </span>
                    </div>
                  )}

                  {coupon.maxDiscount && (
                    <div className="flex items-center justify-between">
                      <span>Desconto Máximo (Teto):</span>
                      <span className="font-semibold text-white font-mono">
                        {formatPrice(coupon.maxDiscount)}
                      </span>
                    </div>
                  )}

                  {/* Usage count */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span>Utilizações:</span>
                      <span className="font-mono text-white font-semibold">
                        {coupon.usageCount} {coupon.usageLimit ? `/ ${coupon.usageLimit}` : 'utilizações'}
                      </span>
                    </div>
                    {coupon.usageLimit && (
                      <div className="w-full bg-black/50 h-1.5 rounded-full overflow-hidden border border-white/5">
                        <div
                          className="h-full bg-[#FF6500] rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(
                              100,
                              (coupon.usageCount / coupon.usageLimit) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Expiration date */}
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5">
                    <span className="flex items-center gap-1">
                      <Clock size={12} className="text-zinc-500" /> Validade:
                    </span>
                    <span className="font-mono text-zinc-300">
                      {coupon.expiresAt
                        ? new Date(coupon.expiresAt).toLocaleDateString('pt-BR')
                        : 'Ilimitada (Sem data)'}
                    </span>
                  </div>
                </div>

                {/* Card Action Bar */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                  <button
                    onClick={() => openEditModal(coupon)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors border border-white/5"
                  >
                    <Edit2 size={13} /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(coupon.id, coupon.code)}
                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                    title="Excluir cupom"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Criar / Editar Cupom */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#101010] border border-white/15 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-[#FF6500] font-bold uppercase">
                  {editingCoupon ? 'PROMOÇÕES // EDIÇÃO' : 'PROMOÇÕES // NOVO CUPOM'}
                </span>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">
                  {editingCoupon ? `Editar Cupom: ${editingCoupon.code}` : 'Cadastrar Novo Cupom'}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Suggestions Presets */}
            {!editingCoupon && (
              <div className="space-y-1.5">
                <span className="text-[11px] text-zinc-400 font-semibold block">
                  Sugestões Rápidas:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickCode('FOCUS10', 'PERCENTAGE', 10)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-[#FF6500]/20 text-zinc-300 hover:text-[#FF6500] border border-white/10 text-[11px] font-mono font-bold"
                  >
                    FOCUS10 (10% OFF)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickCode('CYBER20', 'PERCENTAGE', 20)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-[#FF6500]/20 text-zinc-300 hover:text-[#FF6500] border border-white/10 text-[11px] font-mono font-bold"
                  >
                    CYBER20 (20% OFF)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickCode('BEMVINDO30', 'FIXED_AMOUNT', 30)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-[#FF6500]/20 text-zinc-300 hover:text-[#FF6500] border border-white/10 text-[11px] font-mono font-bold"
                  >
                    BEMVINDO30 (R$ 30 OFF)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickCode('FRETEGRATIS', 'FREE_SHIPPING', 0)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-[#FF6500]/20 text-zinc-300 hover:text-[#FF6500] border border-white/10 text-[11px] font-mono font-bold"
                  >
                    FRETEGRATIS
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {/* Cupom Code */}
              <div className="space-y-1.5">
                <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                  Código do Cupom * (ex: FOCUS10)
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      code: e.target.value.toUpperCase().replace(/\s+/g, ''),
                    })
                  }
                  placeholder="EX: FOCUS10"
                  className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white font-mono text-sm font-black uppercase outline-none"
                />
              </div>

              {/* Discount Type */}
              <div className="space-y-1.5">
                <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                  Tipo de Desconto *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discountType: 'PERCENTAGE' })}
                    className={`py-2.5 px-3 rounded-xl border text-center font-bold transition-all ${
                      formData.discountType === 'PERCENTAGE'
                        ? 'bg-[#FF6500] text-white border-[#FF6500] shadow-md shadow-[#FF6500]/20'
                        : 'bg-[#181818] text-zinc-400 border-white/10 hover:text-white'
                    }`}
                  >
                    Porcentagem (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discountType: 'FIXED_AMOUNT' })}
                    className={`py-2.5 px-3 rounded-xl border text-center font-bold transition-all ${
                      formData.discountType === 'FIXED_AMOUNT'
                        ? 'bg-[#FF6500] text-white border-[#FF6500] shadow-md shadow-[#FF6500]/20'
                        : 'bg-[#181818] text-zinc-400 border-white/10 hover:text-white'
                    }`}
                  >
                    Valor Fixo (R$)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, discountType: 'FREE_SHIPPING', discountValue: 0 })
                    }
                    className={`py-2.5 px-3 rounded-xl border text-center font-bold transition-all ${
                      formData.discountType === 'FREE_SHIPPING'
                        ? 'bg-[#FF6500] text-white border-[#FF6500] shadow-md shadow-[#FF6500]/20'
                        : 'bg-[#181818] text-zinc-400 border-white/10 hover:text-white'
                    }`}
                  >
                    Frete Grátis
                  </button>
                </div>
              </div>

              {/* Discount Value */}
              {formData.discountType !== 'FREE_SHIPPING' && (
                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                    {formData.discountType === 'PERCENTAGE'
                      ? 'Porcentagem de Desconto (%) *'
                      : 'Valor do Desconto (R$) *'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.discountValue}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        discountValue: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder={formData.discountType === 'PERCENTAGE' ? '10' : '25.00'}
                    className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-[#FF6500] font-bold text-sm outline-none font-mono"
                  />
                </div>
              )}

              {/* Min Order & Max Discount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                    Valor Mínimo do Pedido (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.minOrderAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, minOrderAmount: e.target.value })
                    }
                    placeholder="Opcional (ex: 150.00)"
                    className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                    Teto Máximo de Desconto (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.maxDiscount}
                    onChange={(e) =>
                      setFormData({ ...formData, maxDiscount: e.target.value })
                    }
                    placeholder="Opcional (ex: 50.00)"
                    className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none font-mono"
                  />
                </div>
              </div>

              {/* Usage Limit & Expiration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                    Limite de Utilizações Totais
                  </label>
                  <input
                    type="number"
                    value={formData.usageLimit}
                    onChange={(e) =>
                      setFormData({ ...formData, usageLimit: e.target.value })
                    }
                    placeholder="Ilimitado ou ex: 100"
                    className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                    Data de Expiração (Validade)
                  </label>
                  <input
                    type="date"
                    value={formData.expiresAt}
                    onChange={(e) =>
                      setFormData({ ...formData, expiresAt: e.target.value })
                    }
                    className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none font-mono"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none bg-[#181818] border border-white/10 rounded-xl px-3.5 py-2.5 text-white">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="accent-[#FF6500] rounded w-4 h-4"
                  />
                  <span className="font-bold text-xs">Cupom Ativo e Disponível para Uso</span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-[#FF6500] hover:bg-[#FF7A1A] text-white font-bold uppercase tracking-wider px-6"
                >
                  {saving ? 'Salvando...' : editingCoupon ? 'Salvar Alterações' : 'Criar Cupom'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}