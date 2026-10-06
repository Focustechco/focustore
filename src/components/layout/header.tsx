'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Heart, ShoppingBag, User, Menu, X } from 'lucide-react';
import { useCart } from '@/modules/cart/cart-context';
import { useFavorites } from '@/modules/favorites/favorites-context';
import { FocusLogo } from '@/components/ui/focus-logo';

export function Header() {
  const router = useRouter();
  const { totalItems, setIsCartOpen } = useCart();
  const { totalFavorites } = useFavorites();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/busca?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#080808]/95 backdrop-blur-md border-b border-white/10">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-3 sm:gap-8">
        {/* LOGO FOCUS STORE OFICIAL */}
        <Link href="/" className="flex items-center flex-shrink-0 relative overflow-visible -ml-1 sm:ml-0">
          <FocusLogo size="lg" />
        </Link>

        {/* BARRA DE PESQUISA CENTRALIZADA E MAIS COMPACTA */}
        <div className="hidden md:flex flex-1 justify-center px-4">
          <form
            onSubmit={handleSearch}
            className="w-full max-w-[360px] relative flex items-center"
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar produtos..."
              className="w-full bg-[#141414] hover:bg-[#181818] border border-white/10 focus:border-[#FF6500] focus:ring-1 focus:ring-[#FF6500] rounded-full py-2 pl-10 pr-4 text-xs text-white placeholder-zinc-500 focus:outline-none transition-all"
            />
            <Search className="absolute left-3.5 text-zinc-500" size={15} />
          </form>
        </div>

        {/* AÇÕES À DIREITA */}
        <div className="flex items-center gap-3 sm:gap-5 flex-shrink-0">
          <Link
            href="/conta"
            className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-white/90 hover:text-[#FF6500] transition-colors tracking-wide uppercase"
          >
            <User size={16} className="text-zinc-400" />
            <span>Entrar</span>
          </Link>

          <Link
            href="/conta/favoritos"
            className="relative p-1 text-white/90 hover:text-[#FF6500] transition-colors flex items-center justify-center group focus:outline-none"
            aria-label="Ver favoritos"
          >
            <Heart
              size={22}
              className={`transition-colors ${
                totalFavorites > 0
                  ? 'text-[#FF6500] fill-[#FF6500]'
                  : 'text-white group-hover:text-[#FF6500]'
              }`}
            />
            {totalFavorites > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-[#FF6500] text-white text-[10px] font-black w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center shadow-[#FF6500]/60 shadow-sm px-1">
                {totalFavorites}
              </span>
            )}
          </Link>

          {/* ÍCONE CLEAN DE CARRINHO (SEM MOLDURA E SEM NOME) */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-1 text-white/90 hover:text-[#FF6500] transition-colors flex items-center justify-center group focus:outline-none"
            aria-label="Abrir carrinho"
          >
            {/* Ícone de Sacola / Carrinho Clean Fiel à Referência */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6 text-white group-hover:text-[#FF6500] transition-colors"
            >
              <path d="M7 4 H17 L20 8 V18 C20 19.5 18.5 21 17 21 H7 C5.5 21 4 19.5 4 18 V8 L7 4 Z" />
              <path d="M10 8.5 C10 9.8 10.9 10.8 12 10.8 C13.1 10.8 14 9.8 14 8.5" />
            </svg>

            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-[#FF6500] text-white text-[10px] font-black w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center shadow-[#FF6500]/60 shadow-sm px-1">
                {totalItems}
              </span>
            )}
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-white hover:text-[#FF6500]"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-[#121212] px-4 py-4 border-b border-white/10 space-y-3">
          <form onSubmit={handleSearch} className="relative flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar produtos..."
              className="w-full bg-[#181818] border border-white/10 rounded-lg py-2 pl-10 pr-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF6500]"
            />
            <Search className="absolute left-3 text-zinc-500" size={16} />
          </form>

          <div className="grid grid-cols-2 gap-2 pt-2 text-xs font-medium">
            <Link
              href="/conta"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 bg-[#181818] rounded-md text-white flex items-center gap-2"
            >
              <User size={16} className="text-[#FF6500]" /> Entrar / Conta
            </Link>
            <Link
              href="/conta/favoritos"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 bg-[#181818] rounded-md text-white flex items-center gap-2"
            >
              <Heart size={16} className="text-[#FF6500]" /> Favoritos
            </Link>
            <Link
              href="/admin/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="col-span-2 p-2.5 bg-[#FF6500]/10 border border-[#FF6500]/30 text-[#FF6500] rounded-md flex items-center justify-center font-bold"
            >
              Painel Administrativo
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}