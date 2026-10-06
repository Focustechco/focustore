'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Printer,
  ArrowLeft,
  Sun,
  Moon,
  Tag,
  Layers,
  Sparkles,
  Download,
  CheckCircle2,
  Calendar,
  Globe,
  Mail,
  LayoutGrid,
  List,
  Search,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/utils/formatters';
import { FocusLogo } from '@/components/ui/focus-logo';

interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string | null;
  description: string;
  brand: string;
  basePrice: number;
  promotionalPrice: number | null;
  images: { url: string; altText: string | null }[];
  categories: { category: { id: string; name: string; slug: string } }[];
  collections: { collection: { id: string; name: string; slug: string } }[];
  variants: {
    id: string;
    sku: string;
    name: string;
    color: string | null;
    colorHex: string | null;
    size: string | null;
    price: number;
    promotionalPrice: number | null;
  }[];
}

export function CatalogPdfView({ products }: { products: any[] }) {
  const [theme, setTheme] = useState<'clean' | 'dark'>('clean'); // Clean white default for printing
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid'); // Grid vs List view
  const [columns, setColumns] = useState<2 | 3 | 4>(4); // 4 products per row default
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedCollection, setSelectedCollection] = useState('ALL');

  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Extract unique categories & collections
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => {
      p.categories?.forEach((pc: any) => {
        if (pc.category) map.set(pc.category.id, pc.category.name);
      });
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  const collections = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => {
      p.collections?.forEach((cp: any) => {
        if (cp.collection) map.set(cp.collection.id, cp.collection.name);
      });
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        search === '' ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());

      const matchesCat =
        selectedCategory === 'ALL' ||
        p.categories?.some((pc: any) => pc.category.id === selectedCategory);

      const matchesCol =
        selectedCollection === 'ALL' ||
        p.collections?.some((cp: any) => cp.collection.id === selectedCollection);

      return matchesSearch && matchesCat && matchesCol;
    });
  }, [products, search, selectedCategory, selectedCollection]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className={`w-full min-h-screen transition-colors duration-300 font-sans print:min-h-0 ${
        theme === 'dark' ? 'bg-[#080808] text-white' : 'bg-white text-zinc-900'
      }`}
    >
      {/* 1. Barra de Ações & Filtros Superior (Oculta na Impressão/PDF) */}
      <header
        data-no-print="true"
        className="no-print print:hidden sticky top-0 z-50 bg-[#0F0F0F] text-white border-b border-white/10 px-4 sm:px-8 py-3.5 shadow-2xl backdrop-blur-md space-y-3"
      >
        {/* Top Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/produtos"
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              title="Voltar aos produtos"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-base sm:text-lg font-black uppercase tracking-tight">
                Catálogo Oficial ({filteredProducts.length} de {products.length} Produtos)
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Seletor de Modo Grade / Lista */}
            <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setLayoutMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  layoutMode === 'grid'
                    ? 'bg-[#FF6500] text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Visualização em Grade com 4 Produtos por Linha"
              >
                <LayoutGrid size={14} />
                <span className="hidden sm:inline">Grade</span>
              </button>
              <button
                onClick={() => setLayoutMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  layoutMode === 'list'
                    ? 'bg-[#FF6500] text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Visualização em Lista / Tabela Executiva"
              >
                <List size={14} />
                <span className="hidden sm:inline">Lista</span>
              </button>
            </div>

            {/* Seletor de Colunas para Grade */}
            {layoutMode === 'grid' && (
              <div className="hidden sm:flex items-center bg-white/5 p-1 rounded-xl border border-white/10 text-xs font-semibold">
                <span className="text-zinc-500 text-[10px] uppercase font-mono px-2 font-bold">Colunas:</span>
                {[2, 3, 4].map((col) => (
                  <button
                    key={col}
                    onClick={() => setColumns(col as any)}
                    className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                      columns === col
                        ? 'bg-[#FF6500] text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {col}
                  </button>
                ))}
              </div>
            )}

            {/* Alternador de Tema Claro / Escuro */}
            <button
              onClick={() => setTheme(theme === 'clean' ? 'dark' : 'clean')}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              {theme === 'clean' ? (
                <>
                  <Moon size={14} className="text-indigo-400" />
                  <span className="hidden md:inline">Modo Escuro</span>
                </>
              ) : (
                <>
                  <Sun size={14} className="text-amber-400" />
                  <span className="hidden md:inline">Modo Claro</span>
                </>
              )}
            </button>

            {/* Botão de Impressão / Salvar PDF */}
            <Button
              onClick={handlePrint}
              className="gap-2 bg-[#FF6500] hover:bg-[#FF7A1A] text-white font-bold uppercase tracking-wider text-xs px-5 shadow-lg shadow-[#FF6500]/25"
            >
              <Printer size={16} /> Salvar como PDF
            </Button>
          </div>
        </div>

        {/* Filter Bar Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-white/5 text-xs">
          {/* Busca */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por nome ou SKU..."
              className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl pl-9 pr-3 py-2 text-white outline-none text-xs"
            />
          </div>

          {/* Categoria */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl px-3 py-2 text-white outline-none text-xs cursor-pointer"
            >
              <option value="ALL">Todas as Categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Coleção */}
          <div>
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl px-3 py-2 text-white outline-none text-xs cursor-pointer"
            >
              <option value="ALL">Todas as Coleções</option>
              {collections.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* 2. Conteúdo do Catálogo Formatado para A4 (Exportado com Perfeição) */}
      <main className="max-w-[1020px] mx-auto p-6 sm:p-10 space-y-8">
        {/* Cabeçalho Oficial do Catálogo */}
        <div
          className={`pb-5 border-b flex flex-col sm:flex-row sm:items-end justify-between gap-4 ${
            theme === 'dark' ? 'border-white/10' : 'border-zinc-200'
          }`}
        >
          {/* Lado Esquerdo: Logo & Título com hierarquia precisa e espaçamento compacto */}
          <div className="space-y-2">
            <div className="-ml-0.5">
              <FocusLogo size="2xl" variant={theme === 'dark' ? 'dark' : 'light'} priority />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight leading-tight">
                Catálogo de Produtos // Coleção 2026
              </h2>
            </div>
          </div>

          {/* Lado Direito: Metadados perfeitamente paralelos ao título */}
          <div
            className={`text-xs space-y-1 font-mono sm:text-right flex-shrink-0 pb-1 ${
              theme === 'dark' ? 'text-zinc-400' : 'text-black'
            }`}
          >
            <p className={`flex sm:justify-end items-center gap-1.5 font-bold ${
              theme === 'dark' ? 'text-white' : 'text-black'
            }`}>
              <Calendar size={13} className="text-[#FF6500]" /> Emissão: {currentDate}
            </p>
            <p className={`flex sm:justify-end items-center gap-1.5 font-medium ${
              theme === 'dark' ? 'text-zinc-400' : 'text-black'
            }`}>
              <Globe size={13} className="text-[#FF6500]" /> www.focusstore.com.br
            </p>
            <p className={`flex sm:justify-end items-center gap-1.5 font-medium ${
              theme === 'dark' ? 'text-zinc-400' : 'text-black'
            }`}>
              <Mail size={13} className="text-[#FF6500]" /> contato@focusstore.com.br
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* OPÇÃO 1: VISUALIZAÇÃO EM GRADE (4 PRODUTOS POR LINHA / GRID LOOKBOOK)     */}
        {/* ========================================================================= */}
        {layoutMode === 'grid' ? (
          <div
            className={`catalog-grid grid gap-3.5 sm:gap-4 ${
              columns === 4
                ? 'grid-cols-2 sm:grid-cols-4 print:grid-cols-4'
                : columns === 3
                ? 'grid-cols-2 sm:grid-cols-3 print:grid-cols-3'
                : 'grid-cols-1 sm:grid-cols-2 print:grid-cols-2'
            }`}
          >
            {filteredProducts.map((product) => {
              const coverImage = product.images?.[0]?.url || '/images/products/placeholder.jpg';
              const categoryName = product.categories?.[0]?.category?.name || 'Geral';
              const collectionName = product.collections?.[0]?.collection?.name;

              const colors = Array.from(
                new Set(
                  product.variants
                    ?.map((v: any) => JSON.stringify({ color: v.color, colorHex: v.colorHex }))
                    .filter(Boolean)
                )
              ).map((s: any) => JSON.parse(s));

              const sizes = Array.from(
                new Set(product.variants?.map((v: any) => v.size).filter(Boolean))
              );

              return (
                <div
                  key={product.id}
                  className={`page-break rounded-xl border p-3 flex flex-col justify-between space-y-2.5 transition-all shadow-sm ${
                    theme === 'dark'
                      ? 'bg-[#101010] border-white/10'
                      : 'bg-zinc-50/70 border-zinc-200'
                  }`}
                >
                  {/* Product Image & Badges */}
                  <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-zinc-900/10 border border-black/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverImage}
                      alt={product.name}
                      className="w-full h-full object-cover object-center"
                    />

                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                      <span className="px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-white font-mono text-[8px] font-bold uppercase tracking-wider">
                        {categoryName}
                      </span>
                      {collectionName && (
                        <span className="px-1.5 py-0.5 rounded bg-[#FF6500] text-white font-mono text-[8px] font-bold uppercase tracking-wider">
                          {collectionName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="space-y-1 flex-1">
                    <h3
                      className={`text-xs sm:text-sm font-black uppercase tracking-tight leading-snug line-clamp-2 ${
                        theme === 'dark' ? 'text-white' : 'text-zinc-900'
                      }`}
                    >
                      {product.name}
                    </h3>
                    <span className="font-mono text-[9px] text-zinc-400 font-semibold block truncate">
                      SKU: {product.sku}
                    </span>
                  </div>

                  {/* Variants (Colors & Sizes) */}
                  <div
                    className={`pt-1.5 border-t flex items-center justify-between gap-1 text-[10px] ${
                      theme === 'dark' ? 'border-white/5 text-zinc-400' : 'border-zinc-200 text-zinc-600'
                    }`}
                  >
                    {/* Cores */}
                    <div className="flex items-center gap-1">
                      {colors.length > 0 ? (
                        <div className="flex items-center gap-0.5">
                          {colors.slice(0, 3).map((c: any, cIdx: number) => (
                            <span
                              key={cIdx}
                              className="w-2.5 h-2.5 rounded-full border border-black/20 inline-block shadow-sm"
                              style={{ backgroundColor: c.colorHex || '#000000' }}
                              title={c.color}
                            />
                          ))}
                        </div>
                      ) : (
                        <span className="font-mono text-[9px]">Padrão</span>
                      )}
                    </div>

                    {/* Tamanhos */}
                    {sizes.length > 0 && (
                      <div className="flex items-center gap-0.5 font-mono text-[9px] font-bold">
                        <span className="text-[8px] uppercase font-sans font-semibold text-zinc-500">Tam:</span>
                        <span>{sizes.slice(0, 3).join(',')}</span>
                      </div>
                    )}
                  </div>

                  {/* Preço de 1 Unidade em Destaque */}
                  <div
                    className={`p-2 rounded-lg border flex items-center justify-between ${
                      theme === 'dark'
                        ? 'bg-[#181818] border-white/5'
                        : 'bg-white border-zinc-200 shadow-sm'
                    }`}
                  >
                    <div>
                      <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-zinc-400 block leading-tight">
                        Preço 1 un
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-black font-mono text-[#FF6500]">
                          {formatPrice(product.promotionalPrice || product.basePrice)}
                        </span>
                        {product.promotionalPrice && (
                          <span className="text-[10px] line-through text-zinc-400 font-mono">
                            {formatPrice(product.basePrice)}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded bg-[#FF6500]/15 text-[#FF6500] uppercase">
                      BRL
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ========================================================================= */
          /* OPÇÃO 2: VISUALIZAÇÃO EM LISTA / TABELA EXECUTIVA DE PREÇOS                */
          /* ========================================================================= */
          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10 shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead
                className={`uppercase tracking-wider font-semibold border-b text-[10px] ${
                  theme === 'dark'
                    ? 'bg-[#141414] text-zinc-400 border-white/10'
                    : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                }`}
              >
                <tr>
                  <th className="p-3">Foto</th>
                  <th className="p-3">Produto & Descrição</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Categoria / Coleção</th>
                  <th className="p-3">Grade (Tam/Cores)</th>
                  <th className="p-3 text-right">Preço Unitário (1 un)</th>
                </tr>
              </thead>
              <tbody
                className={`divide-y ${
                  theme === 'dark'
                    ? 'divide-white/5 bg-[#0D0D0D] text-white'
                    : 'divide-zinc-200 bg-white text-zinc-900'
                }`}
              >
                {filteredProducts.map((product) => {
                  const coverImage = product.images?.[0]?.url || '/images/products/placeholder.jpg';
                  const categoryName = product.categories?.[0]?.category?.name || 'Geral';
                  const collectionName = product.collections?.[0]?.collection?.name;

                  const colors = Array.from(
                    new Set(product.variants?.map((v: any) => v.color).filter(Boolean))
                  );
                  const sizes = Array.from(
                    new Set(product.variants?.map((v: any) => v.size).filter(Boolean))
                  );

                  return (
                    <tr key={product.id} className="page-break hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      {/* Foto */}
                      <td className="p-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 flex-shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={coverImage}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </td>

                      {/* Nome */}
                      <td className="p-3 max-w-[240px]">
                        <span className="font-bold block text-sm leading-tight line-clamp-1">
                          {product.name}
                        </span>
                        <span className="text-[11px] text-zinc-500 block truncate mt-0.5">
                          {product.shortDescription || 'Item de alta performance Focus.'}
                        </span>
                      </td>

                      {/* SKU */}
                      <td className="p-3 font-mono text-[11px] text-zinc-500 font-semibold">
                        {product.sku}
                      </td>

                      {/* Categoria / Coleção */}
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 font-bold text-[10px] block w-max">
                          {categoryName}
                        </span>
                        {collectionName && (
                          <span className="text-[10px] font-mono text-[#FF6500] font-semibold block mt-0.5">
                            {collectionName}
                          </span>
                        )}
                      </td>

                      {/* Grade */}
                      <td className="p-3 text-[11px] font-mono text-zinc-500">
                        {sizes.length > 0 ? sizes.join(', ') : 'Único'}
                        {colors.length > 0 && ` • ${colors.join(', ')}`}
                      </td>

                      {/* Preço Unitário */}
                      <td className="p-3 text-right">
                        <span className="font-mono font-black text-sm text-[#FF6500] block">
                          {formatPrice(product.promotionalPrice || product.basePrice)}
                        </span>
                        {product.promotionalPrice && (
                          <span className="text-[10px] line-through text-zinc-400 font-mono block">
                            {formatPrice(product.basePrice)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Rodapé Oficial do Catálogo */}
        <div
          className={`pt-8 pb-4 border-t text-center text-xs space-y-2 ${
            theme === 'dark' ? 'border-white/10 text-zinc-500' : 'border-zinc-300 text-black'
          }`}
        >
          <div className="flex items-center justify-center">
            <span className={`font-bold uppercase tracking-wider ${
              theme === 'dark' ? 'text-zinc-400' : 'text-black'
            }`}>
              FOCUS STORE® • Techwear & Lifestyle
            </span>
          </div>
          <p className="text-[11px] font-medium">
            Preços podem variar de acordo com a data do catálogo gerado.
          </p>
        </div>
      </main>

      {/* Regras CSS Globais para Impressão e PDF Perfeito */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 8mm 8mm 8mm 8mm;
        }

        @media print {
          html, body {
            background-color: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }

          aside,
          nav,
          header.no-print,
          .no-print,
          [role="navigation"],
          button,
          .print\\:hidden {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            overflow: hidden !important;
          }

          .catalog-grid {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 12px !important;
            width: 100% !important;
          }

          .page-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          main {
            max-width: 100% !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
        }
      `}</style>
    </div>
  );
}
