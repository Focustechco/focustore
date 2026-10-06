'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Warehouse,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Minus,
  RefreshCw,
  History,
  TrendingDown,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Save,
  X,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/utils/formatters';

interface InventoryItem {
  id: string; // variant id
  sku: string;
  name: string;
  color: string | null;
  colorHex: string | null;
  size: string | null;
  price: number;
  product: {
    id: string;
    name: string;
    basePrice: number;
    images: { url: string }[];
    categories: { category: { id: string; name: string } }[];
  };
  inventory: {
    id: string;
    quantityAvailable: number;
    quantityReserved: number;
    lowStockThreshold: number;
    movements: {
      id: string;
      type: string;
      quantity: number;
      reason: string | null;
      createdAt: string;
    }[];
  } | null;
}

export default function AdminInventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // Adjustment Modal State
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState<number>(0);
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN');
  const [adjustReason, setAdjustReason] = useState('Reposição de Lote');
  const [adjusting, setAdjusting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/inventory');
      const data = await res.json();
      if (data.success) {
        setItems(data.variants);

        // Extract unique categories
        const catMap = new Map();
        data.variants.forEach((v: InventoryItem) => {
          v.product.categories?.forEach((pc) => {
            if (pc.category) catMap.set(pc.category.id, pc.category);
          });
        });
        setCategories(Array.from(catMap.values()));
      }
    } catch (err) {
      console.error('Erro ao buscar estoque:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  // Quick adjust inline (+1 or -1)
  const handleQuickAdjust = async (variantId: string, delta: number) => {
    try {
      // Optimistic update
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === variantId) {
            const current = item.inventory?.quantityAvailable || 0;
            const newQty = Math.max(0, current + delta);
            return {
              ...item,
              inventory: item.inventory
                ? { ...item.inventory, quantityAvailable: newQty }
                : { id: '', quantityAvailable: newQty, quantityReserved: 0, lowStockThreshold: 5, movements: [] },
            };
          }
          return item;
        })
      );

      await fetch(`/api/admin/inventory/${variantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantityChange: delta,
          movementType: delta > 0 ? 'IN' : 'OUT',
          reason: delta > 0 ? 'Ajuste rápido (+1)' : 'Ajuste rápido (-1)',
        }),
      });
    } catch (err) {
      fetchInventory();
    }
  };

  // Open modal for detailed adjustment & movement history
  const openAdjustmentModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setAdjustQuantity(10);
    setAdjustType('IN');
    setAdjustReason('Reposição de Lote de Fornecedor');
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || adjustQuantity <= 0) return;

    try {
      setAdjusting(true);
      const delta = adjustType === 'OUT' ? -adjustQuantity : adjustQuantity;

      const res = await fetch(`/api/admin/inventory/${selectedItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantityChange: delta,
          movementType: adjustType,
          reason: adjustReason,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({
          type: 'success',
          text: `Estoque de ${selectedItem.product.name} (${selectedItem.name}) ajustado para ${data.newQuantity} unidades.`,
        });
        setSelectedItem(null);
        fetchInventory();
        setTimeout(() => setMessage(null), 4000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao ajustar estoque.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro de conexão.' });
    } finally {
      setAdjusting(false);
    }
  };

  // Calculations for KPIs
  const totalAvailableUnits = items.reduce(
    (acc, v) => acc + (v.inventory?.quantityAvailable || 0),
    0
  );
  const totalReservedUnits = items.reduce(
    (acc, v) => acc + (v.inventory?.quantityReserved || 0),
    0
  );
  const lowStockCount = items.filter((v) => {
    const qty = v.inventory?.quantityAvailable || 0;
    const threshold = v.inventory?.lowStockThreshold || 5;
    return qty > 0 && qty <= threshold;
  }).length;
  const outOfStockCount = items.filter(
    (v) => (v.inventory?.quantityAvailable || 0) <= 0
  ).length;

  const totalStockValue = items.reduce((acc, v) => {
    const qty = v.inventory?.quantityAvailable || 0;
    const price = v.price || v.product.basePrice;
    return acc + qty * price;
  }, 0);

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      search === '' ||
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.product.name.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      selectedCategory === 'ALL' ||
      item.product.categories?.some((c) => c.category.id === selectedCategory);

    const qty = item.inventory?.quantityAvailable || 0;
    const threshold = item.inventory?.lowStockThreshold || 5;

    let matchesStatus = true;
    if (statusFilter === 'OUT_OF_STOCK') matchesStatus = qty <= 0;
    if (statusFilter === 'LOW_STOCK') matchesStatus = qty > 0 && qty <= threshold;
    if (statusFilter === 'IN_STOCK') matchesStatus = qty > threshold;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
            Controle de Estoque & Reservas
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Monitore unidades disponíveis, produtos em checkout e realize ajustes com registro de movimentações.
          </p>
        </div>

        <Button
          onClick={fetchInventory}
          variant="outline"
          className="gap-2 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border-white/10 text-xs"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar Saldo
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Disponível */}
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
              Estoque Disponível
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{totalAvailableUnits}</span>
              <span className="text-xs text-zinc-500 font-mono">unidades prontas</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#FF6500]">
            <Warehouse size={22} />
          </div>
        </div>

        {/* Reservado no Checkout */}
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
              Reservado (Checkout)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-400">{totalReservedUnits}</span>
              <span className="text-xs text-zinc-500 font-mono">carrinhos ativos</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Layers size={22} />
          </div>
        </div>

        {/* Alertas Críticos / Baixo */}
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
              Estoque Crítico / Baixo
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-red-400">
                {outOfStockCount + lowStockCount}
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                ({outOfStockCount} zerados)
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <AlertTriangle size={22} />
          </div>
        </div>

        {/* Valor Total de Inventário */}
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
              Valor Total do Estoque
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-emerald-400 font-mono">
                {formatPrice(totalStockValue)}
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Sparkles size={22} />
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
            placeholder="Buscar por SKU, produto ou cor..."
            className="w-full bg-[#101010] border border-white/10 focus:border-[#FF6500] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none"
          />
        </div>

        <div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full bg-[#101010] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
          >
            <option value="ALL">Todas as Categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-[#101010] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
          >
            <option value="ALL">Todos os Níveis de Estoque</option>
            <option value="IN_STOCK">Estoque Normal (&gt; 5 un)</option>
            <option value="LOW_STOCK">Estoque Baixo (1 a 5 un)</option>
            <option value="OUT_OF_STOCK">Esgotado (0 un)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center p-16 text-zinc-500 text-xs animate-pulse">
          Carregando inventário de produtos...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-12 text-center space-y-3">
          <Warehouse size={32} className="text-zinc-600 mx-auto" />
          <h3 className="text-sm font-bold text-white uppercase">Nenhuma variante encontrada</h3>
          <p className="text-xs text-zinc-400">Tente ajustar seus termos de pesquisa ou filtros.</p>
        </div>
      ) : (
        <div className="bg-[#0D0D0D] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141414] text-zinc-400 uppercase tracking-wider font-semibold border-b border-white/10">
                <tr>
                  <th className="p-4">SKU / Variante</th>
                  <th className="p-4">Produto</th>
                  <th className="p-4">Categoria</th>
                  <th className="p-4">Preço Unit.</th>
                  <th className="p-4">Disponível</th>
                  <th className="p-4">Reservado</th>
                  <th className="p-4">Total Físico</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white">
                {filteredItems.map((item) => {
                  const available = item.inventory?.quantityAvailable || 0;
                  const reserved = item.inventory?.quantityReserved || 0;
                  const total = available + reserved;
                  const threshold = item.inventory?.lowStockThreshold || 5;
                  const isOutOfStock = available <= 0;
                  const isLow = available > 0 && available <= threshold;
                  const coverImage =
                    item.product.images?.[0]?.url || '/images/products/placeholder.jpg';

                  return (
                    <tr key={item.id} className="hover:bg-white/[0.03] transition-colors group">
                      {/* SKU & Swatch */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <span className="font-mono font-bold text-white text-[11px] block">
                            {item.sku}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {item.colorHex && (
                              <span
                                className="w-3 h-3 rounded-full border border-white/20 inline-block"
                                style={{ backgroundColor: item.colorHex }}
                              />
                            )}
                            <span className="text-[11px] text-zinc-400">
                              {item.color || ''} {item.size ? `(${item.size})` : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Product Name */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-lg bg-black border border-white/10 overflow-hidden flex-shrink-0">
                            <Image
                              src={coverImage}
                              alt={item.product.name}
                              fill
                              sizes="44px"
                              className="object-cover"
                            />
                          </div>
                          <span className="font-bold text-white block group-hover:text-[#FF6500] transition-colors line-clamp-1 max-w-[200px]">
                            {item.product.name}
                          </span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-4 text-zinc-300">
                        {item.product.categories?.[0]?.category?.name || 'Geral'}
                      </td>

                      {/* Unit Price */}
                      <td className="p-4 font-mono text-zinc-300 font-semibold">
                        {formatPrice(item.price || item.product.basePrice)}
                      </td>

                      {/* Available with quick adjustments */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleQuickAdjust(item.id, -1)}
                            disabled={available <= 0}
                            className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 disabled:opacity-30 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                            title="Diminuir 1 unidade"
                          >
                            <Minus size={11} />
                          </button>
                          <span
                            className={`font-mono font-black text-sm px-2.5 py-0.5 rounded-lg ${
                              isOutOfStock
                                ? 'text-red-400 bg-red-500/10 border border-red-500/20'
                                : isLow
                                ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                                : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                            }`}
                          >
                            {available}
                          </span>
                          <button
                            onClick={() => handleQuickAdjust(item.id, 1)}
                            className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                            title="Aumentar 1 unidade"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      </td>

                      {/* Reserved */}
                      <td className="p-4">
                        <span className="font-mono text-amber-400 font-semibold text-xs">
                          {reserved} un
                        </span>
                      </td>

                      {/* Total */}
                      <td className="p-4 font-mono text-white font-bold text-xs">{total} un</td>

                      {/* Status */}
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                            isOutOfStock
                              ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                              : isLow
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {isOutOfStock ? (
                            <>
                              <XCircle size={11} /> Esgotado
                            </>
                          ) : isLow ? (
                            <>
                              <AlertTriangle size={11} /> Baixo ({available})
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={11} /> Normal
                            </>
                          )}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="p-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAdjustmentModal(item)}
                          className="gap-1.5 bg-white/5 hover:bg-[#FF6500] hover:text-white text-zinc-300 border-white/10 text-[11px] py-1 px-2.5 h-8"
                        >
                          <History size={12} />
                          <span>Ajustar</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Ajuste de Estoque & Histórico */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#101010] border border-white/15 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-[#FF6500] font-bold uppercase">
                  ESTOQUE // AJUSTE & LOG
                </span>
                <h2 className="text-xl font-black text-white uppercase tracking-tight mt-0.5">
                  {selectedItem.product.name}
                </h2>
                <p className="text-xs text-zinc-400 font-mono">
                  SKU: {selectedItem.sku} • {selectedItem.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Saldo Atual */}
            <div className="grid grid-cols-3 gap-3 bg-[#161616] p-4 rounded-2xl border border-white/5 text-center text-xs">
              <div>
                <span className="text-zinc-500 uppercase font-semibold text-[10px] block">
                  Disponível
                </span>
                <span className="text-lg font-mono font-black text-emerald-400">
                  {selectedItem.inventory?.quantityAvailable || 0}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 uppercase font-semibold text-[10px] block">
                  Reservado
                </span>
                <span className="text-lg font-mono font-black text-amber-400">
                  {selectedItem.inventory?.quantityReserved || 0}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 uppercase font-semibold text-[10px] block">
                  Total Físico
                </span>
                <span className="text-lg font-mono font-black text-white">
                  {(selectedItem.inventory?.quantityAvailable || 0) +
                    (selectedItem.inventory?.quantityReserved || 0)}
                </span>
              </div>
            </div>

            {/* Formulário de Movimentação */}
            <form onSubmit={handleSaveAdjustment} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                  Tipo de Movimentação *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('IN')}
                    className={`py-2 px-3 rounded-xl border text-center font-bold transition-all flex items-center justify-center gap-1.5 ${
                      adjustType === 'IN'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-[#181818] text-zinc-400 border-white/10'
                    }`}
                  >
                    <ArrowUpRight size={14} /> Entrada (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('OUT')}
                    className={`py-2 px-3 rounded-xl border text-center font-bold transition-all flex items-center justify-center gap-1.5 ${
                      adjustType === 'OUT'
                        ? 'bg-red-500/20 text-red-400 border-red-500/40'
                        : 'bg-[#181818] text-zinc-400 border-white/10'
                    }`}
                  >
                    <ArrowDownRight size={14} /> Saída (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('ADJUSTMENT')}
                    className={`py-2 px-3 rounded-xl border text-center font-bold transition-all flex items-center justify-center gap-1.5 ${
                      adjustType === 'ADJUSTMENT'
                        ? 'bg-[#FF6500]/20 text-[#FF6500] border-[#FF6500]/40'
                        : 'bg-[#181818] text-zinc-400 border-white/10'
                    }`}
                  >
                    <RefreshCw size={13} /> Ajuste Contagem
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                    Quantidade de Unidades *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={adjustQuantity}
                    onChange={(e) => setAdjustQuantity(parseInt(e.target.value) || 0)}
                    className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white font-mono font-bold text-sm outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                    Motivo / Justificativa *
                  </label>
                  <select
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none"
                  >
                    <option value="Reposição de Lote de Fornecedor">Reposição de Lote</option>
                    <option value="Ajuste de Balanço / Inventário">Ajuste de Balanço</option>
                    <option value="Devolução de Pedido">Devolução de Pedido</option>
                    <option value="Perda / Avaria / Descarte">Perda ou Avaria</option>
                    <option value="Brinde / Amostra Promocional">Brinde Promocional</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <Button
                  type="submit"
                  disabled={adjusting}
                  className="bg-[#FF6500] hover:bg-[#FF7A1A] text-white font-bold uppercase tracking-wider px-6"
                >
                  {adjusting ? 'Salvando...' : 'Confirmar Movimentação'}
                </Button>
              </div>
            </form>

            {/* Histórico Recente de Movimentações */}
            {selectedItem.inventory?.movements && selectedItem.inventory.movements.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-white/10 text-xs">
                <h4 className="text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <History size={13} className="text-[#FF6500]" /> Últimas Movimentações Registradas
                </h4>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {selectedItem.inventory.movements.map((mov) => (
                    <div
                      key={mov.id}
                      className="bg-[#141414] p-2.5 rounded-xl border border-white/5 flex items-center justify-between text-[11px]"
                    >
                      <div className="space-y-0.5">
                        <span className="font-semibold text-white block">{mov.reason}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {new Date(mov.createdAt).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <span
                        className={`font-mono font-bold ${
                          mov.type === 'IN'
                            ? 'text-emerald-400'
                            : mov.type === 'OUT'
                            ? 'text-red-400'
                            : 'text-[#FF6500]'
                        }`}
                      >
                        {mov.type === 'IN' ? `+${mov.quantity}` : `-${mov.quantity}`} un
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}