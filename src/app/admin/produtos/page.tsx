'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  ExternalLink,
  Tag,
  Layers,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Boxes,
  Printer,
  FileDown,
} from 'lucide-react';
import { formatPrice } from '@/lib/utils/formatters';
import { Button } from '@/components/ui/button';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [categories, setCategories] = useState<any[]>([]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/products');
      const data = await res.json();
      if (data.success) {
        setProducts(data.products);

        // Extract unique categories
        const catsMap = new Map();
        data.products.forEach((p: any) => {
          p.categories?.forEach((pc: any) => {
            if (pc.category) catsMap.set(pc.category.id, pc.category);
          });
        });
        setCategories(Array.from(catsMap.values()));
      }
    } catch (err) {
      console.error('Erro ao buscar produtos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente excluir o produto "${name}" e todas as suas variantes?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
      } else {
        alert(data.error || 'Erro ao excluir produto.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão.');
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      search === '' ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      selectedCategory === 'ALL' ||
      p.categories.some((pc: any) => pc.categoryId === selectedCategory);

    const matchesStatus =
      selectedStatus === 'ALL' || p.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
            Gestão de Produtos ({products.length})
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Gerencie preços, estoque, descrições e fotos com sincronização instantânea na loja.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/produtos/catalogo-pdf"
            target="_blank"
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 text-xs font-semibold inline-flex items-center gap-2 transition-all shadow-sm"
          >
            <Printer size={15} className="text-[#FF6500]" />
            <span>Exportar Catálogo (PDF)</span>
          </Link>
          <Link href="/admin/produtos/novo">
            <Button className="gap-2 bg-[#FF6500] hover:bg-[#FF7A1A] text-white font-bold uppercase tracking-wider text-xs">
              <Plus size={16} /> Novo Produto
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou SKU..."
            className="w-full bg-[#101010] border border-white/10 focus:border-[#FF6500] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none"
          />
        </div>

        {/* Category Filter */}
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

        {/* Status Filter */}
        <div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full bg-[#101010] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
          >
            <option value="ALL">Todos os Status</option>
            <option value="ACTIVE">Ativo</option>
            <option value="DRAFT">Rascunho</option>
            <option value="ARCHIVED">Arquivado</option>
          </select>
        </div>
      </div>

      {/* Product Table */}
      {loading ? (
        <div className="flex items-center justify-center p-16 text-zinc-500 text-xs animate-pulse">
          Carregando catálogo de produtos...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-12 text-center space-y-3">
          <Package size={32} className="text-zinc-600 mx-auto" />
          <h3 className="text-sm font-bold text-white uppercase">Nenhum produto encontrado</h3>
          <p className="text-xs text-zinc-400">
            Tente ajustar os filtros de busca ou cadastre um novo produto.
          </p>
        </div>
      ) : (
        <div className="bg-[#0D0D0D] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141414] text-zinc-400 uppercase tracking-wider font-semibold border-b border-white/10">
                <tr>
                  <th className="p-4">Produto</th>
                  <th className="p-4">SKU Base</th>
                  <th className="p-4">Categoria</th>
                  <th className="p-4">Preço Base</th>
                  <th className="p-4">Variantes & Cores</th>
                  <th className="p-4">Estoque Total</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white">
                {filteredProducts.map((p) => {
                  const coverImage = p.images?.[0]?.url || '/images/products/placeholder.jpg';
                  const totalStock = p.variants?.reduce(
                    (acc: number, v: any) => acc + (v.inventory?.quantityAvailable || 0),
                    0
                  );
                  const colors = Array.from(
                    new Set(p.variants?.map((v: any) => v.color).filter(Boolean))
                  );

                  return (
                    <tr key={p.id} className="hover:bg-white/[0.03] transition-colors group">
                      {/* Product Thumbnail & Title */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-11 h-11 rounded-lg bg-black border border-white/10 overflow-hidden flex-shrink-0">
                            <Image
                              src={coverImage}
                              alt={p.name}
                              fill
                              sizes="44px"
                              className="object-cover"
                            />
                          </div>
                          <div>
                            <span className="font-bold text-white block group-hover:text-[#FF6500] transition-colors line-clamp-1 max-w-[220px]">
                              {p.name}
                            </span>
                            {p.collections?.[0]?.collection?.name && (
                              <span className="text-[10px] font-mono text-[#FF6500] tracking-wider block">
                                {p.collections[0].collection.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="p-4 font-mono text-zinc-400 text-[11px]">{p.sku}</td>

                      {/* Category */}
                      <td className="p-4 text-zinc-300">
                        {p.categories?.[0]?.category?.name || 'Geral'}
                      </td>

                      {/* Price */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <span className="font-bold text-[#FF6500] block">
                            {formatPrice(p.basePrice)}
                          </span>
                          {p.promotionalPrice && (
                            <span className="text-[10px] text-emerald-400 font-mono block">
                              Promo: {formatPrice(p.promotionalPrice)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Variants & Colors */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <span className="text-zinc-300 block font-medium">
                            {p.variants?.length || 0} variantes
                          </span>
                          {colors.length > 0 && (
                            <div className="flex items-center gap-1">
                              {p.variants
                                .filter((v: any, idx: number, self: any[]) =>
                                  idx === self.findIndex((t: any) => t.color === v.color)
                                )
                                .slice(0, 4)
                                .map((v: any) => (
                                  <span
                                    key={v.id}
                                    className="w-3.5 h-3.5 rounded-full border border-white/20 inline-block shadow-sm"
                                    style={{ backgroundColor: v.colorHex || '#000000' }}
                                    title={v.color}
                                  />
                                ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Stock */}
                      <td className="p-4">
                        <span
                          className={`font-mono font-bold text-xs px-2 py-0.5 rounded-md inline-block ${
                            totalStock > 20
                              ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                              : totalStock > 0
                              ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                              : 'text-red-400 bg-red-500/10 border border-red-500/20'
                          }`}
                        >
                          {totalStock} un
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block ${
                            p.status === 'ACTIVE'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : p.status === 'DRAFT'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-zinc-800 text-zinc-400 border border-white/10'
                          }`}
                        >
                          {p.status === 'ACTIVE' ? 'Ativo' : p.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={`/produto/${p.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                            title="Ver produto na loja"
                          >
                            <ExternalLink size={13} />
                          </a>
                          <Link
                            href={`/admin/produtos/${p.id}/editar`}
                            className="p-2 rounded-lg bg-white/5 hover:bg-[#FF6500] hover:text-white text-zinc-300 border border-white/5 transition-colors"
                            title="Editar produto"
                          >
                            <Edit2 size={13} />
                          </Link>
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                            title="Excluir produto"
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
    </div>
  );
}