'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Image as ImageIcon,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  Check,
  X,
  Sparkles,
  ArrowRight,
  UploadCloud,
  Loader2,
  Layers,
  Camera,
  Layers3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  imageUrl: string;
  position: number;
  placement: string;
  isActive: boolean;
  createdAt: string;
}

type TabType = 'home_hero' | 'home_featured' | 'home_real_life';

export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('home_hero');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    ctaText: '',
    ctaLink: '',
    imageUrl: '',
    position: 0,
    placement: 'home_hero',
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/banners');
      const data = await res.json();
      if (data.success) {
        setBanners(data.banners);
      }
    } catch (err) {
      console.error('Erro ao carregar banners:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const openCreateModal = (defaultPlacement?: string) => {
    setEditingBanner(null);
    const placementToUse = defaultPlacement || activeTab;

    setFormData({
      title: '',
      subtitle: '',
      ctaText:
        placementToUse === 'home_hero'
          ? 'Ver Coleção'
          : placementToUse === 'home_featured'
          ? 'Explorar'
          : 'Ver no Instagram',
      ctaLink:
        placementToUse === 'home_hero'
          ? '/categoria/vestuario'
          : placementToUse === 'home_featured'
          ? '/categoria/todos'
          : 'https://instagram.com/focus.store',
      imageUrl: '',
      position: banners.filter((b) => b.placement === placementToUse).length,
      placement: placementToUse,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      subtitle: banner.subtitle || '',
      ctaText: banner.ctaText || '',
      ctaLink: banner.ctaLink || '',
      imageUrl: banner.imageUrl,
      position: banner.position,
      placement: banner.placement,
      isActive: banner.isActive,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingBanner(null);
  };

  // Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const uploadData = new FormData();
    uploadData.append('file', file);
    uploadData.append(
      'folder',
      formData.placement === 'home_real_life' ? 'images/community' : 'images/banners'
    );

    try {
      setUploading(true);
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: uploadData,
      });

      const data = await res.json();
      if (data.success) {
        setFormData((prev) => ({ ...prev, imageUrl: data.url }));
        setMessage({ type: 'success', text: 'Foto enviada com sucesso!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro no upload da foto.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Falha no envio do arquivo.' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.imageUrl.trim()) {
      setMessage({ type: 'error', text: 'Preencha o título/identificação e a imagem.' });
      return;
    }

    try {
      setSaving(true);
      const url = editingBanner
        ? `/api/admin/banners/${editingBanner.id}`
        : '/api/admin/banners';
      const method = editingBanner ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setMessage({
          type: 'success',
          text: editingBanner
            ? 'Item atualizado com sucesso! Alteração refletida na loja.'
            : 'Novo item criado com sucesso e ativado na loja!',
        });
        closeModal();
        fetchBanners();
        setTimeout(() => setMessage(null), 4000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao salvar.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro de conexão.' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (banner: Banner) => {
    try {
      const updatedStatus = !banner.isActive;
      setBanners((prev) =>
        prev.map((b) => (b.id === banner.id ? { ...b, isActive: updatedStatus } : b))
      );

      const res = await fetch(`/api/admin/banners/${banner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: updatedStatus }),
      });

      const data = await res.json();
      if (!data.success) {
        fetchBanners();
      }
    } catch (err) {
      fetchBanners();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este banner/item?')) return;
    try {
      const res = await fetch(`/api/admin/banners/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Item excluído com sucesso!' });
        fetchBanners();
        setTimeout(() => setMessage(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredBanners = banners.filter((b) => b.placement === activeTab);

  const getPlacementBadge = (placement: string) => {
    switch (placement) {
      case 'home_hero':
        return { label: 'Hero Principal', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
      case 'home_featured':
        return { label: 'Destaques (3 Cards)', color: 'bg-[#FF6500]/10 text-[#FF6500] border-[#FF6500]/20' };
      case 'home_real_life':
        return { label: 'Focus in Real Life', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
      default:
        return { label: placement, color: 'bg-zinc-800 text-zinc-400 border-white/10' };
    }
  };

  const countByPlacement = (placement: string) =>
    banners.filter((b) => b.placement === placement).length;

  const getCreateButtonLabel = () => {
    switch (activeTab) {
      case 'home_hero':
        return 'Novo Slide da Hero';
      case 'home_featured':
        return 'Novo Card de Destaque';
      case 'home_real_life':
        return 'Nova Foto da Comunidade';
      default:
        return 'Novo Item';
    }
  };

  const getModalTitle = () => {
    const isEdit = Boolean(editingBanner);
    const placement = formData.placement;
    if (placement === 'home_hero') {
      return isEdit ? 'Editar Slide da Hero' : 'Novo Slide da Hero';
    }
    if (placement === 'home_featured') {
      return isEdit ? 'Editar Card de Destaque' : 'Novo Card de Destaque';
    }
    if (placement === 'home_real_life') {
      return isEdit ? 'Editar Foto da Comunidade' : 'Nova Foto Focus in Real Life';
    }
    return isEdit ? 'Editar Item' : 'Novo Item';
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
            Gerenciador de Banners & Fotos
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Personalize e crie novos slides para a Hero, cards de destaques e fotos da galeria Focus in Real Life.
          </p>
        </div>

        <Button
          onClick={() => openCreateModal()}
          className="gap-2 bg-[#FF6500] hover:bg-[#FF7A1A] text-white shadow-lg shadow-[#FF6500]/20 font-bold"
        >
          <Plus size={16} /> {getCreateButtonLabel()}
        </Button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/10 scrollbar-none">
        <button
          onClick={() => setActiveTab('home_hero')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'home_hero'
              ? 'bg-[#FF6500] text-white shadow-md shadow-[#FF6500]/20'
              : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
          }`}
        >
          <Layers size={14} />
          <span>Hero Principal ({countByPlacement('home_hero')})</span>
        </button>

        <button
          onClick={() => setActiveTab('home_featured')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'home_featured'
              ? 'bg-[#FF6500] text-white shadow-md shadow-[#FF6500]/20'
              : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
          }`}
        >
          <Layers3 size={14} />
          <span>Destaques (3 Cards) ({countByPlacement('home_featured')})</span>
        </button>

        <button
          onClick={() => setActiveTab('home_real_life')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'home_real_life'
              ? 'bg-[#FF6500] text-white shadow-md shadow-[#FF6500]/20'
              : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
          }`}
        >
          <Camera size={14} />
          <span>Focus in Real Life ({countByPlacement('home_real_life')})</span>
        </button>
      </div>

      {/* Alert message */}
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

      {/* Banners Grid */}
      {loading ? (
        <div className="flex items-center justify-center p-16 text-zinc-500 text-xs animate-pulse">
          Carregando dados do banco...
        </div>
      ) : filteredBanners.length === 0 ? (
        <div className="bg-[#0D0D0D] border border-white/10 rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-white/5 mx-auto flex items-center justify-center text-zinc-500">
            <ImageIcon size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white uppercase">Nenhum item cadastrado nesta seção</h3>
            <p className="text-xs text-zinc-400">
              Clique no botão abaixo para adicionar um novo item a esta seção da loja.
            </p>
          </div>
          <Button onClick={() => openCreateModal()} size="sm" className="gap-2 bg-[#FF6500]">
            <Plus size={14} /> {getCreateButtonLabel()}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBanners.map((banner) => {
            const badge = getPlacementBadge(banner.placement);
            const isRealLife = banner.placement === 'home_real_life';

            return (
              <div
                key={banner.id}
                className={`group bg-[#0D0D0D] rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col ${
                  banner.isActive
                    ? 'border-white/10 hover:border-[#FF6500]/40 shadow-lg'
                    : 'border-white/5 opacity-60'
                }`}
              >
                {/* Preview Image */}
                <div
                  className={`relative w-full bg-[#141414] overflow-hidden ${
                    isRealLife ? 'h-60' : 'h-44'
                  }`}
                >
                  <Image
                    src={banner.imageUrl}
                    alt={banner.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                  {/* Badge Pos & Placement */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-white font-mono text-[10px] border border-white/10">
                      Pos #{banner.position}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase backdrop-blur-md border ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase backdrop-blur-md ${
                        banner.isActive
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-400 border border-white/10'
                      }`}
                    >
                      {banner.isActive ? 'Ativo' : 'Pausado'}
                    </span>
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <h3 className="text-sm font-black uppercase tracking-tight line-clamp-1">
                      {banner.title.replace('\n', ' ')}
                    </h3>
                  </div>
                </div>

                {/* Banner Details */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                    {banner.subtitle || 'Sem subtítulo / descrição cadastrada.'}
                  </p>

                  {(banner.ctaText || banner.ctaLink) && (
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
                      <span className="text-zinc-500 font-mono">Link / Ação:</span>
                      <span className="font-semibold text-white inline-flex items-center gap-1 truncate max-w-[200px]">
                        {banner.ctaText || 'Link'} → <span className="text-zinc-400 truncate">{banner.ctaLink}</span>
                      </span>
                    </div>
                  )}

                  {/* Action Toolbar */}
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleToggleActive(banner)}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                        banner.isActive
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-zinc-800 border-white/10 text-zinc-400 hover:text-white'
                      }`}
                      title={banner.isActive ? 'Desativar item' : 'Ativar item'}
                    >
                      {banner.isActive ? <Eye size={13} /> : <EyeOff size={13} />}
                      <span>{banner.isActive ? 'Visível' : 'Oculto'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditModal(banner)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/5 transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(banner.id)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Criar / Editar Banner com Upload de Fotos */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#101010] border border-white/15 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-mono tracking-widest text-[#FF6500] font-bold uppercase">
                  {editingBanner ? 'CMS // EDIÇÃO' : 'CMS // NOVO REGISTRO'}
                </span>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">
                  {getModalTitle()}
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
              {/* Seletor de Seção / Posicionamento */}
              <div className="space-y-1.5">
                <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                  Seção de Exibição *
                </label>
                <select
                  value={formData.placement}
                  onChange={(e) => setFormData({ ...formData, placement: e.target.value })}
                  className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none text-xs font-semibold"
                >
                  <option value="home_hero">Hero Principal (Slides no topo da Home)</option>
                  <option value="home_featured">Destaques (3 Cards abaixo da Hero: Kits, Exclusivos, Movimento)</option>
                  <option value="home_real_life">Focus in Real Life (Galeria de Fotos da Comunidade)</option>
                </select>
              </div>

              {/* Upload de Imagem e URL */}
              <div className="space-y-2">
                <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                  Foto / Imagem * (Upload do Dispositivo ou URL)
                </label>

                {/* Upload Button Box */}
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/png, image/jpeg, image/webp, image/svg+xml"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="gap-2 bg-white/5 border-white/10 hover:border-[#FF6500] hover:bg-[#FF6500]/10 text-white text-xs py-2 px-4 rounded-xl"
                  >
                    {uploading ? (
                      <>
                        <Loader2 size={16} className="animate-spin text-[#FF6500]" />
                        <span>Enviando Foto...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={16} className="text-[#FF6500]" />
                        <span>Fazer Upload do Dispositivo</span>
                      </>
                    )}
                  </Button>
                  <span className="text-[11px] text-zinc-400">
                    ou informe o caminho/URL do arquivo:
                  </span>
                </div>

                <input
                  type="text"
                  required
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder={
                    formData.placement === 'home_real_life'
                      ? 'Ex: /images/community/sua-foto.jpg ou URL externa'
                      : 'Ex: /images/banners/seu-banner.png ou URL externa'
                  }
                  className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none font-mono text-xs"
                />

                {formData.imageUrl && (
                  <div
                    className={`relative rounded-xl overflow-hidden border border-white/10 mt-2 bg-black ${
                      formData.placement === 'home_real_life' ? 'h-48 max-w-[200px]' : 'h-32'
                    }`}
                  >
                    <Image
                      src={formData.imageUrl}
                      alt="Preview"
                      fill
                      sizes="600px"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent p-3 flex items-center">
                      <span className="text-[10px] font-mono text-zinc-300 bg-black/60 px-2 py-1 rounded border border-white/10">
                        Preview ao Vivo
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Title & Subtitle com placeholders contextuais */}
              <div className="space-y-1.5">
                <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                  {formData.placement === 'home_real_life'
                    ? 'Instagram Handle / Nome (@usuario) *'
                    : 'Título Principal * (Dica: Use Enter para quebrar linha em destaque)'}
                </label>
                <textarea
                  required
                  rows={2}
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={
                    formData.placement === 'home_real_life'
                      ? 'Ex: @seu_usuario ou @focus.community'
                      : formData.placement === 'home_featured'
                      ? 'Ex: KITS E\nPRESENTES'
                      : 'Ex: IDEIAS TAMBÉM\nSE USAM.'
                  }
                  className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none font-bold text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                  {formData.placement === 'home_real_life'
                    ? 'Produto Usado / Descrição da Foto'
                    : 'Subtítulo / Descrição'}
                </label>
                <textarea
                  rows={2}
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                  placeholder={
                    formData.placement === 'home_real_life'
                      ? 'Ex: Camisa Focus Classic Black & Boné Lab'
                      : formData.placement === 'home_featured'
                      ? 'Ex: Para quem pensa diferente.'
                      : 'Ex: Linha exclusiva desenvolvida para quem vive tecnologia...'
                  }
                  className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none text-xs"
                />
              </div>

              {/* CTA Button Text & Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                    {formData.placement === 'home_real_life' ? 'Texto da Tag' : 'Texto do Botão (CTA)'}
                  </label>
                  <input
                    type="text"
                    value={formData.ctaText}
                    onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                    placeholder={
                      formData.placement === 'home_real_life' ? 'Ex: Ver no Instagram' : 'Ex: Ver Coleção'
                    }
                    className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                    Link de Destino / URL
                  </label>
                  <input
                    type="text"
                    value={formData.ctaLink}
                    onChange={(e) => setFormData({ ...formData, ctaLink: e.target.value })}
                    placeholder={
                      formData.placement === 'home_real_life'
                        ? 'https://instagram.com/focus.store'
                        : '/categoria/vestuario'
                    }
                    className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none text-xs"
                  />
                </div>
              </div>

              {/* Position & Active */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-zinc-300 font-bold uppercase tracking-wider block">
                    Ordem de Exibição (Posição)
                  </label>
                  <input
                    type="number"
                    value={formData.position}
                    onChange={(e) =>
                      setFormData({ ...formData, position: parseInt(e.target.value) || 0 })
                    }
                    className="w-full bg-[#181818] border border-white/10 focus:border-[#FF6500] rounded-xl px-3.5 py-2.5 text-white outline-none text-xs"
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
                    <span className="font-bold text-xs">Exibir na Loja (Ativo)</span>
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
                  disabled={saving || uploading}
                  className="bg-[#FF6500] hover:bg-[#FF7A1A] text-white font-bold uppercase tracking-wider px-6"
                >
                  {saving ? 'Salvando...' : editingBanner ? 'Salvar Alterações' : 'Criar Item'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
