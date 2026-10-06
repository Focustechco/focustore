'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Layers,
  Plus,
  Search,
  Edit2,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  Package,
  Sparkles,
  Shirt,
  Headphones,
  Coffee,
  Smartphone,
  Gift,
  Star,
  Tag,
  Zap,
  Flame,
  ShoppingBag,
  TrendingUp,
  X,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  iconName: string | null;
  position: number;
  isActive: boolean;
  _count?: { products: number };
}

const AVAILABLE_ICONS: { [key: string]: any } = {
  Shirt: Shirt,
  Headphones: Headphones,
  Coffee: Coffee,
  Smartphone: Smartphone,
  Gift: Gift,
  Star: Star,
  Tag: Tag,
  Zap: Zap,
  Flame: Flame,
  ShoppingBag: ShoppingBag,
  Layers: Layers,
  Sparkles: Sparkles,
};

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    iconName: 'Layers',
    position: 0,
    isActive: true,
  });

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/categories');
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories);
      }
    } catch (err) {
      console.error('Erro ao carregar categorias:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      iconName: 'Layers',
      position: categories.length + 1,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      iconName: cat.iconName || 'Layers',
      position: cat.position,
      isActive: cat.isActive,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
  };

  const handleNameChange = (nameVal: string) => {
    setFormData((prev) => {
      const updated = { ...prev, name: nameVal };
      if (!editingCategory && (!prev.slug || prev.slug === '')) {
        updated.slug = nameVal
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-');
      }
      return updated;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'Informe o nome da categoria.' });
      return;
    }

    try {
      setSaving(true);
      const url = editingCategory
        ? `/api/admin/categories/${editingCategory.id}`
        : '/api/admin/categories';
      const method = editingCategory ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({
          type: 'success',
          text: editingCategory
            ? `Categoria "${formData.name}" atualizada com sucesso!`
            : `Categoria "${formData.name}" criada com sucesso!`,
        });
        closeModal();
        fetchCategories();
        setTimeout(() => setMessage(null), 4000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao salvar categoria.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro de conexão.' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (cat: Category) => {
    try {
      const updatedStatus = !cat.isActive;
      // Optimistic update
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, isActive: updatedStatus } : c))
      );

      const res = await fetch(`/api/admin/categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: updatedStatus }),
      });

      const data = await res.json();
      if (!data.success) {
        fetchCategories();
      }
    } catch (err) {
      fetchCategories();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente excluir a categoria "${name}"? Os produtos vinculados serão mantidos no catálogo geral.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Categoria "${name}" excluída com sucesso.` });
        fetchCategories();
        setTimeout(() => setMessage(null), 4000);
      } else {
        alert(data.error || 'Erro ao excluir categoria.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // KPIs
  const totalCategories = categories.length;
  const activeCategories = categories.filter((c) => c.isActive).length;
  const totalProducts = categories.reduce((acc, c) => acc + (c._count?.products || 0), 0);

  const filteredCategories = categories.filter((c) => {
    return (
      search === '' ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.slug.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
            Gestão de Categorias ({categories.length})
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Organize os departamentos da loja, ícones do menu e departamentos da vitrine virtual.
          </p>
        </div>

        <Button
          onClick={openCreateModal}
          className="gap-2 bg-[#FF6500] hover:bg-[#FF7A1A] text-white font-bold uppercase tracking-wider text-xs"
        >
          <Plus size={16} /> Nova Categoria
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
              Total de Categorias
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{totalCategories}</span>
              <span className="text-xs text-emerald-400 font-mono font-bold">
                ({activeCategories} ativas)
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#FF6500]">
            <Layers size={22} />
          </div>
        </div>

        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
              Categorias Ativas
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-400">{activeCategories}</span>
              <span className="text-xs text-zinc-500 font-mono">visíveis no menu</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Check size={22} />
          </div>
        </div>

        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block">
              Produtos Classificados
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#FF6500]">{totalProducts}</span>
              <span className="text-xs text-zinc-500 font-mono">itens associados</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#FF6500]/10 border border-[#FF6500]/20 flex items-center justify-center text-[#FF6500]">
            <Package size={22} />
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

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por categoria ou slug..."
          className="w-full bg-[#101010] border border-white/10 focus:border-[#FF6500] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none"
        />
      </div>

      {/* Categories Table */}
      {loading ? (
        <div className="flex items-center justify-center p-16 text-zinc-500 text-xs animate-pulse">
          Carregando categorias...
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-12 text-center space-y-3">
          <Layers size={32} className="text-zinc-600 mx-auto" />
          <h3 className="text-sm font-bold text-white uppercase">Nenhuma categoria encontrada</h3>
          <p className="text-xs text-zinc-400">Cadastre a primeira categoria da sua loja.</p>
        </div>
      ) : (
        <div className="bg-[#0D0D0D] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141414] text-zinc-400 uppercase tracking-wider font-semibold border-b border-white/10">
                <tr>
                  <th className="p-4">Ícone & Categoria</th>
                  <th className="p-4">Slug (URL)</th>
                  <th className="p-4">Descrição</th>
                  <th className="p-4">Produtos</th>
                  <th className="p-4">Posição</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white">
                {filteredCategories.map((cat) => {
                  const IconComponent =
                    (cat.iconName && AVAILABLE_ICONS[cat.iconName]) || Layers;

                  return (
                    <tr key={cat.id} className="hover:bg-white/[0.03] transition-colors group">
                      {/* Name & Icon */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#FF6500] flex-shrink-0 group-hover:border-[#FF6500]/50 transition-colors">
                            <IconComponent size={18} />
                          </div>
                          <span className="font-bold text-white text-sm block group-hover:text-[#FF6500] transition-colors">
                            {cat.name}
                          </span>
                        </div>
                      </td>

                      {/* Slug */}
                      <td className="p-4 font-mono text-zinc-400 text-[11px]">
                        /categoria/{cat.slug}
                      </td>

                      {/* Description */}
                      <td className="p-4 text-zinc-400 text-[11px] max-w-xs truncate">
                        {cat.description || '—'}
                      </td>

                      {/* Products count */}
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 font-mono font-bold text-xs text-white inline-flex items-center gap-1.5">
                          <Package size={12} className="text-[#FF6500]" />
                          {cat._count?.products || 0} produtos
                        </span>
                      </td>

                      {/* Position */}
                      <td className="p-4 font-mono text-zinc-300 font-bold text-xs">
                        #{cat.position}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block ${
                            cat.isActive
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-zinc-800 text-zinc-400 border border-white/10'
                          }`}
                        >
                          {cat.isActive ? 'Ativa' : 'Oculta'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleActive(cat)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              cat.isActive
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                                : 'bg-zinc-800 border-white/10 text-zinc-400 hover:text-white'
                            }`}
                            title={cat.isActive ? 'Desativar categoria' : 'Ativar categoria'}
                          >
                            {cat.isActive ? <Eye size={13} /> : <EyeOff size={13} />}
                          </button>

                          <a
                            href={`/categoria/${cat.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                            title="Ver na loja"
                          >
                            <ExternalLink size={13} />
                          </a>

                          <button
                            onClick={() => openEditModal(cat)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-[#FF6500] hover:text-white text-zinc-300 border border-white/5 transition-colors"
                            title="Editar categoria"
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            onClick={() => handleDelete(cat.id, cat.name)}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                            title="Excluir categoria"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Criar / Editar Categoria */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#101010] border border-white/15 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-[#FF6500] font-bold uppercase">
                  {editingCategory ? 'CATÁLOGO // EDIÇÃO' : 'CATÁLOGO // NOVA CATEGORIA'}
                </span>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">
                  {editingCategory ? `Editar: ${editingCategory.name}` : 'Cadastrar Nova Categoria'}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              {/* Nome */}
              <div className="space-y-1.5">
                <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                  Nome da Categoria *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Vestuário, Acessórios, Lifestyle..."
                  className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white font-bold outline-none"
                />
              </div>

              {/* Slug */}
              <div className="space-y-1.5">
                <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                  Slug (URL) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="vestuario"
                  className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-zinc-300 font-mono text-xs outline-none"
                />
              </div>

              {/* Descrição */}
              <div className="space-y-1.5">
                <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                  Descrição Curta (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição exibida no topo do catálogo..."
                  className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none"
                />
              </div>

              {/* Seletor de Ícone Visual */}
              <div className="space-y-2">
                <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                  Ícone Visual do Menu
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {Object.keys(AVAILABLE_ICONS).map((iconKey) => {
                    const IconComp = AVAILABLE_ICONS[iconKey];
                    const isSelected = formData.iconName === iconKey;

                    return (
                      <button
                        key={iconKey}
                        type="button"
                        onClick={() => setFormData({ ...formData, iconName: iconKey })}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                          isSelected
                            ? 'bg-[#FF6500] text-white border-[#FF6500] shadow-md shadow-[#FF6500]/20'
                            : 'bg-[#181818] text-zinc-400 border-white/10 hover:text-white hover:bg-white/5'
                        }`}
                        title={iconKey}
                      >
                        <IconComp size={20} />
                        <span className="text-[9px] truncate max-w-full font-mono font-medium">
                          {iconKey}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Posição e Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                    Posição / Ordem no Menu
                  </label>
                  <input
                    type="number"
                    value={formData.position}
                    onChange={(e) =>
                      setFormData({ ...formData, position: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none font-mono"
                  />
                </div>

                <div className="space-y-1.5 flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer select-none bg-[#181818] border border-white/10 rounded-xl px-3.5 py-2.5 text-white">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                      className="accent-[#FF6500] rounded w-4 h-4"
                    />
                    <span className="font-bold text-xs">Categoria Ativa na Loja</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
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
                  {saving ? 'Salvando...' : editingCategory ? 'Salvar Alterações' : 'Criar Categoria'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
