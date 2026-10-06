'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  Image as ImageIcon,
  Layers,
  Sparkles,
  DollarSign,
  Tag,
  PackageCheck,
  AlertCircle,
  ExternalLink,
  UploadCloud,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Collection {
  id: string;
  name: string;
  slug: string;
}

interface VariantInput {
  id?: string;
  sku: string;
  name: string;
  color: string;
  colorHex: string;
  size: string;
  price: number;
  promotionalPrice?: number | null;
  imageUrl?: string;
  stock: number;
  isActive: boolean;
}

interface ProductFormProps {
  initialProduct?: any;
  categories: Category[];
  collections: Collection[];
  isEditing?: boolean;
}

export function ProductForm({
  initialProduct,
  categories,
  collections,
  isEditing = false,
}: ProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState(initialProduct?.name || '');
  const [slug, setSlug] = useState(initialProduct?.slug || '');
  const [sku, setSku] = useState(initialProduct?.sku || '');
  const [brand, setBrand] = useState(initialProduct?.brand || 'Focus');
  const [status, setStatus] = useState(initialProduct?.status || 'ACTIVE');
  const [isFeatured, setIsFeatured] = useState(initialProduct?.isFeatured || false);

  const [basePrice, setBasePrice] = useState<number | string>(
    initialProduct?.basePrice !== undefined ? initialProduct.basePrice : ''
  );
  const [promotionalPrice, setPromotionalPrice] = useState<number | string>(
    initialProduct?.promotionalPrice !== undefined && initialProduct?.promotionalPrice !== null
      ? initialProduct.promotionalPrice
      : ''
  );
  const [costPrice, setCostPrice] = useState<number | string>(
    initialProduct?.costPrice !== undefined && initialProduct?.costPrice !== null
      ? initialProduct.costPrice
      : ''
  );

  const [shortDescription, setShortDescription] = useState(
    initialProduct?.shortDescription || ''
  );
  const [description, setDescription] = useState(initialProduct?.description || '');

  // Selected Categories & Collections
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    initialProduct?.categories?.map((c: any) => c.categoryId) || []
  );
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(
    initialProduct?.collections?.map((c: any) => c.collectionId) || []
  );

  // Images list
  const [images, setImages] = useState<string[]>(
    initialProduct?.images?.map((img: any) => img.url) || ['']
  );

  // Variants list
  const [variants, setVariants] = useState<VariantInput[]>(
    initialProduct?.variants?.map((v: any) => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      color: v.color || '',
      colorHex: v.colorHex || '',
      size: v.size || '',
      price: v.price,
      promotionalPrice: v.promotionalPrice,
      imageUrl: v.imageUrl || '',
      stock: v.inventory?.quantityAvailable ?? 50,
      isActive: v.isActive,
    })) || [
      {
        sku: '',
        name: '',
        color: 'Preto',
        colorHex: '#0D0D0D',
        size: 'M',
        price: Number(basePrice) || 0,
        stock: 50,
        isActive: true,
      },
    ]
  );

  // Auto-generate slug from name if not manually modified
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEditing && (!slug || slug === '')) {
      const generated = val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      setSlug(generated);
    }
  };

  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  // Image helpers
  const handleAddImage = () => {
    setImages([...images, '']);
  };

  const handleUpdateImage = (index: number, val: string) => {
    const updated = [...images];
    updated[index] = val;
    setImages(updated);
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, idx) => idx !== index));
  };

  const handleUploadImageFile = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const uploadData = new FormData();
    uploadData.append('file', file);
    uploadData.append('folder', 'images/products');

    try {
      setUploadingIndex(index);
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: uploadData,
      });
      const data = await res.json();
      if (data.success) {
        handleUpdateImage(index, data.url);
      } else {
        alert(data.error || 'Erro ao enviar imagem.');
      }
    } catch (err: any) {
      alert(err.message || 'Falha no envio.');
    } finally {
      setUploadingIndex(null);
    }
  };

  // Variant helpers
  const handleAddVariant = () => {
    setVariants([
      ...variants,
      {
        sku: `${sku || 'SKU'}-VAR-${variants.length + 1}`,
        name: `${name || 'Produto'} - Variante`,
        color: 'Preto',
        colorHex: '#0D0D0D',
        size: 'M',
        price: Number(basePrice) || 0,
        promotionalPrice: promotionalPrice ? Number(promotionalPrice) : null,
        stock: 50,
        isActive: true,
      },
    ]);
  };

  const handleUpdateVariant = (index: number, field: keyof VariantInput, val: any) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: val };
    setVariants(updated);
  };

  const handleRemoveVariant = (index: number) => {
    if (variants.length <= 1) {
      alert('O produto precisa ter pelo menos 1 variante.');
      return;
    }
    setVariants(variants.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!name || !sku || basePrice === '') {
      setErrorMessage('Nome, SKU e Preço Base são obrigatórios.');
      return;
    }

    try {
      setLoading(true);
      const cleanedImages = images.filter((img) => img.trim() !== '');

      const payload = {
        name,
        slug,
        sku,
        brand,
        status,
        isFeatured,
        basePrice: Number(basePrice),
        promotionalPrice: promotionalPrice !== '' ? Number(promotionalPrice) : null,
        costPrice: costPrice !== '' ? Number(costPrice) : null,
        shortDescription,
        description,
        categoryIds: selectedCategoryIds,
        collectionIds: selectedCollectionIds,
        images: cleanedImages,
        variants: variants.map((v) => ({
          ...v,
          price: Number(v.price || basePrice),
          promotionalPrice: v.promotionalPrice ? Number(v.promotionalPrice) : null,
          stock: Number(v.stock || 0),
        })),
      };

      const url = isEditing
        ? `/api/admin/products/${initialProduct.id}`
        : '/api/admin/products';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMessage(
          isEditing
            ? 'Produto atualizado com sucesso! Alterações sincronizadas com a loja.'
            : 'Produto criado com sucesso no catálogo!'
        );

        if (!isEditing) {
          setTimeout(() => {
            router.push('/admin/produtos');
          }, 1200);
        }
      } else {
        setErrorMessage(data.error || 'Erro ao processar produto.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado na conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/produtos"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <span className="text-[10px] font-mono tracking-widest text-[#FF6500] font-bold uppercase">
              {isEditing ? 'CATÁLOGO // EDIÇÃO' : 'CATÁLOGO // NOVO PRODUTO'}
            </span>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">
              {isEditing ? `Editar: ${initialProduct.name}` : 'Cadastrar Novo Produto'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isEditing && (
            <a
              href={`/produto/${slug || initialProduct.slug}`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink size={14} /> Ver na Loja
            </a>
          )}
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-[#FF6500] hover:bg-[#FF7A1A] text-white gap-2 font-bold uppercase tracking-wider"
          >
            <Save size={16} /> {loading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Publicar Produto'}
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <PackageCheck size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. INFORMAÇÕES BÁSICAS */}
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
            <Tag size={16} className="text-[#FF6500]" /> Informações Gerais
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-zinc-300 font-semibold block">Nome do Produto *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Camiseta Focus Techwear Heavyweight"
                className="w-full bg-[#161616] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white font-bold outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-300 font-semibold block">Slug (URL amigável) *</label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="camiseta-focus-techwear"
                className="w-full bg-[#161616] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-zinc-300 font-mono text-xs outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-300 font-semibold block">SKU Base *</label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="FS-TSHIRT-001"
                className="w-full bg-[#161616] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white font-mono text-xs outline-none uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-300 font-semibold block">Marca</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Focus"
                className="w-full bg-[#161616] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-300 font-semibold block">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-[#161616] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none"
              >
                <option value="ACTIVE">ATIVO (Visível na loja)</option>
                <option value="DRAFT">RASCUNHO (Oculto)</option>
                <option value="ARCHIVED">ARQUIVADO</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="accent-[#FF6500] rounded w-4 h-4"
              />
              <span className="text-xs font-semibold text-zinc-300">
                Destacar na Página Inicial (Featured Product)
              </span>
            </label>
          </div>
        </div>

        {/* 2. PREÇOS */}
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
            <DollarSign size={16} className="text-[#FF6500]" /> Precificação (R$)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-zinc-300 font-semibold block">Preço Base (R$) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="189.90"
                className="w-full bg-[#161616] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-[#FF6500] font-bold text-sm outline-none font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-300 font-semibold block">Preço Promocional (R$)</label>
              <input
                type="number"
                step="0.01"
                value={promotionalPrice}
                onChange={(e) => setPromotionalPrice(e.target.value)}
                placeholder="159.90 (Opcional)"
                className="w-full bg-[#161616] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-emerald-400 font-bold text-sm outline-none font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-300 font-semibold block">Preço de Custo (R$)</label>
              <input
                type="number"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="65.00 (Opcional)"
                className="w-full bg-[#161616] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-zinc-400 text-sm outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* 3. CATEGORIAS E COLEÇÕES */}
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
            <Layers size={16} className="text-[#FF6500]" /> Categorias & Coleções
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            {/* Categorias */}
            <div className="space-y-2">
              <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                Categorias
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto p-3 bg-[#161616] rounded-xl border border-white/5">
                {categories.map((cat) => {
                  const isChecked = selectedCategoryIds.includes(cat.id);
                  return (
                    <label
                      key={cat.id}
                      className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white py-1"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCategoryIds([...selectedCategoryIds, cat.id]);
                          } else {
                            setSelectedCategoryIds(
                              selectedCategoryIds.filter((id) => id !== cat.id)
                            );
                          }
                        }}
                        className="accent-[#FF6500] rounded"
                      />
                      <span>{cat.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Coleções */}
            <div className="space-y-2">
              <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                Coleções
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto p-3 bg-[#161616] rounded-xl border border-white/5">
                {collections.map((col) => {
                  const isChecked = selectedCollectionIds.includes(col.id);
                  return (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 cursor-pointer text-zinc-300 hover:text-white py-1"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCollectionIds([...selectedCollectionIds, col.id]);
                          } else {
                            setSelectedCollectionIds(
                              selectedCollectionIds.filter((id) => id !== col.id)
                            );
                          }
                        }}
                        className="accent-[#FF6500] rounded"
                      />
                      <span>{col.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 4. IMAGENS DO PRODUTO */}
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
              <ImageIcon size={16} className="text-[#FF6500]" /> Imagens do Catálogo
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddImage}
              className="gap-1 text-xs"
            >
              <Plus size={14} /> Adicionar Linha
            </Button>
          </div>

          <div className="space-y-3">
            {images.map((imgUrl, index) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row sm:items-center gap-3 bg-[#161616] p-3 rounded-xl border border-white/5"
              >
                {/* Preview Thumbnail */}
                <div className="relative w-12 h-12 rounded-lg bg-black border border-white/10 overflow-hidden flex-shrink-0">
                  {imgUrl ? (
                    <Image
                      src={imgUrl}
                      alt={`Imagem ${index + 1}`}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600">
                      <ImageIcon size={16} />
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  value={imgUrl}
                  onChange={(e) => handleUpdateImage(index, e.target.value)}
                  placeholder="/images/products/camiseta-focus-black.jpg ou https://..."
                  className="flex-1 bg-black/50 border border-white/10 focus:border-[#FF6500] rounded-lg px-3 py-2 text-white font-mono text-xs outline-none"
                />

                {/* Upload Button */}
                <label className="cursor-pointer px-3 py-2 rounded-lg bg-white/5 hover:bg-[#FF6500]/10 hover:border-[#FF6500] border border-white/10 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors">
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    onChange={(e) => handleUploadImageFile(e, index)}
                  />
                  {uploadingIndex === index ? (
                    <Loader2 size={14} className="animate-spin text-[#FF6500]" />
                  ) : (
                    <UploadCloud size={14} className="text-[#FF6500]" />
                  )}
                  <span>{uploadingIndex === index ? 'Enviando...' : 'Upload'}</span>
                </label>

                {index === 0 && (
                  <span className="px-2 py-1 rounded bg-[#FF6500]/20 text-[#FF6500] text-[10px] font-bold uppercase self-center">
                    Capa
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="p-2 text-zinc-500 hover:text-red-400 transition-colors self-center"
                  title="Remover imagem"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 5. VARIANTES E ESTOQUE */}
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <PackageCheck size={16} className="text-[#FF6500]" /> Grade de Variantes & Estoque
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Defina cores, tamanhos, preços individuais e saldo de estoque por variante.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddVariant}
              className="gap-1 text-xs"
            >
              <Plus size={14} /> Adicionar Variante
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#161616] text-zinc-400 uppercase tracking-wider font-semibold border-b border-white/10">
                <tr>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Cor</th>
                  <th className="p-3">Hex</th>
                  <th className="p-3">Tamanho</th>
                  <th className="p-3">Preço (R$)</th>
                  <th className="p-3">Estoque</th>
                  <th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white">
                {variants.map((variant, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="p-2">
                      <input
                        type="text"
                        value={variant.sku}
                        onChange={(e) => handleUpdateVariant(idx, 'sku', e.target.value)}
                        placeholder="SKU"
                        className="w-28 bg-black/60 border border-white/10 focus:border-[#FF6500] rounded-lg px-2 py-1.5 font-mono text-[11px] uppercase text-white outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={variant.color}
                        onChange={(e) => handleUpdateVariant(idx, 'color', e.target.value)}
                        placeholder="Ex: Preto"
                        className="w-24 bg-black/60 border border-white/10 focus:border-[#FF6500] rounded-lg px-2 py-1.5 text-white outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={variant.colorHex || '#0D0D0D'}
                          onChange={(e) => handleUpdateVariant(idx, 'colorHex', e.target.value)}
                          className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
                        />
                        <span className="font-mono text-[10px] text-zinc-400">
                          {variant.colorHex}
                        </span>
                      </div>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={variant.size}
                        onChange={(e) => handleUpdateVariant(idx, 'size', e.target.value)}
                        placeholder="Ex: M / Único"
                        className="w-16 bg-black/60 border border-white/10 focus:border-[#FF6500] rounded-lg px-2 py-1.5 font-mono text-[11px] text-white outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        step="0.01"
                        value={variant.price}
                        onChange={(e) =>
                          handleUpdateVariant(idx, 'price', parseFloat(e.target.value) || 0)
                        }
                        className="w-20 bg-black/60 border border-white/10 focus:border-[#FF6500] rounded-lg px-2 py-1.5 font-mono text-[11px] text-[#FF6500] font-bold outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={variant.stock}
                        onChange={(e) =>
                          handleUpdateVariant(idx, 'stock', parseInt(e.target.value) || 0)
                        }
                        className="w-16 bg-black/60 border border-white/10 focus:border-[#FF6500] rounded-lg px-2 py-1.5 font-mono text-[11px] text-white font-bold outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(idx)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 6. DESCRIÇÃO */}
        <div className="bg-[#0E0E0E] rounded-2xl border border-white/10 p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
            <Sparkles size={16} className="text-[#FF6500]" /> Textos & Descrições
          </h2>

          <div className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-zinc-300 font-semibold block">Descrição Curta</label>
              <textarea
                rows={2}
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Resumo em poucas palavras para cards e destaques..."
                className="w-full bg-[#161616] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none text-xs leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-300 font-semibold block">
                Descrição Completa / Especificações Técnicas
              </label>
              <textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes sobre composição, gramatura, modelagem, orientações de lavagem e diferenciais techwear..."
                className="w-full bg-[#161616] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none text-xs leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <Link
            href="/admin/produtos"
            className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-semibold transition-colors"
          >
            Cancelar
          </Link>
          <Button
            type="submit"
            disabled={loading}
            className="bg-[#FF6500] hover:bg-[#FF7A1A] text-white gap-2 font-bold uppercase tracking-wider px-6 text-xs"
          >
            <Save size={16} /> {loading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Publicar Produto'}
          </Button>
        </div>
      </form>
    </div>
  );
}
