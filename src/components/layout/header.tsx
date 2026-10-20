'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Heart, User, Menu, X, LogOut, ShoppingBag } from 'lucide-react';
import { useCart } from '@/modules/cart/cart-context';
import { useFavorites } from '@/modules/favorites/favorites-context';
import { FocusLogo } from '@/components/ui/focus-logo';
import { LoginModal, type CustomerSession } from '@/components/layout/login-modal';

const NAV_ITEMS = [
  { label: 'Todos', href: '/categoria/todos' },
  { label: 'Vestuário', href: '/categoria/vestuario' },
  { label: 'Acessórios', href: '/categoria/acessorios' },
  { label: 'Tecnologia', href: '/categoria/tecnologia' },
  { label: 'Lifestyle', href: '/categoria/lifestyle' },
  { label: 'Coleções', href: '/colecoes' },
  { label: 'Ofertas', href: '/categoria/ofertas' },
];

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { totalItems, setIsCartOpen } = useCart();
  const { totalFavorites } = useFavorites();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [customer, setCustomer] = useState<CustomerSession | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Sessão do cliente retornou HTTP ${response.status}`);
        }
        const result = (await response.json()) as { user: CustomerSession | null };
        if (active) setCustomer(result.user);
      } catch (error) {
        console.error('Não foi possível carregar a sessão do cliente:', error);
      }
    }

    void loadSession();
    return () => {
      active = false;
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/busca?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  function handleAuthenticated(user: CustomerSession) {
    setCustomer(user);
    setIsLoginOpen(false);
    router.push('/conta');
  }

  async function handleLogout() {
    try {
      const response = await fetch('/api/auth/session', { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`Encerramento de sessão retornou HTTP ${response.status}`);
      }
      setCustomer(null);
      router.push('/');
    } catch (error) {
      console.error('Não foi possível encerrar a sessão do cliente:', error);
    }
  }

  const customerName = customer?.name?.trim() || customer?.email.split('@')[0];

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080808] text-white">
      <div className="relative mx-auto flex h-[76px] max-w-[1800px] items-center justify-between gap-3 px-4 sm:px-6 lg:h-[88px] lg:px-10">
        {/* LOGO FOCUS STORE OFICIAL */}
        <Link href="/" className="flex items-center flex-shrink-0 relative overflow-visible -ml-1 sm:ml-0">
          <FocusLogo size="xl" />
        </Link>

        <nav aria-label="Categorias" className="hidden flex-1 items-center justify-center gap-5 xl:flex xl:-translate-x-3 2xl:gap-8">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap text-[11px] font-semibold uppercase transition-colors 2xl:text-xs ${
                  item.label === 'Ofertas'
                    ? 'text-[#FF5500] hover:text-[#df4700]'
                    : isActive
                      ? 'text-[#FF5500]'
                        : 'text-white hover:text-[#FF5500]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* AÇÕES À DIREITA */}
        <div className="flex flex-shrink-0 items-center gap-3 text-white sm:gap-5">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSearchOpen((open) => !open)}
              aria-label="Buscar produtos"
              aria-expanded={isSearchOpen}
              className="flex items-center justify-center p-1 transition-colors hover:text-[#FF5500]"
            >
              <Search size={22} strokeWidth={2.2} />
            </button>
            {isSearchOpen && (
              <form
                onSubmit={handleSearch}
                className="absolute right-0 top-full z-50 mt-4 flex w-[min(85vw,320px)] items-center rounded-lg border border-white/10 bg-[#121212] p-2 shadow-xl"
              >
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar produtos..."
                  className="w-full bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-zinc-500"
                />
                <button
                  type="submit"
                  aria-label="Enviar busca"
                  className="p-2 text-white transition-colors hover:text-[#FF5500]"
                >
                  <Search size={18} />
                </button>
              </form>
            )}
          </div>
          {customer ? (
            <Link
              href="/conta"
              aria-label={`Minha conta: ${customerName}`}
              className="hidden items-center gap-1.5 text-xs font-semibold uppercase tracking-wide transition-colors hover:text-[#FF5500] sm:flex"
            >
              <User size={22} strokeWidth={1.8} />
              <span className="max-w-24 truncate 2xl:max-w-32">Olá, {customerName}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setIsLoginOpen(true)}
              aria-label="Entrar na conta"
              className="hidden items-center justify-center p-1 transition-colors hover:text-[#FF5500] sm:flex"
            >
              <User size={22} strokeWidth={1.8} />
            </button>
          )}

          {customer && (
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sair da conta"
              className="hidden items-center p-1 text-zinc-400 transition-colors hover:text-[#FF5500] sm:flex"
            >
              <LogOut size={16} />
            </button>
          )}

          <Link
            href="/conta/favoritos"
            className="group relative flex items-center justify-center p-1 text-white transition-colors hover:text-[#FF5500] focus:outline-none"
            aria-label="Ver favoritos"
          >
            <Heart
              size={22}
              className={`transition-colors ${
                totalFavorites > 0
                  ? 'fill-[#FF5500] text-[#FF5500]'
                  : 'text-white group-hover:text-[#FF5500]'
              }`}
            />
            {totalFavorites > 0 && (
              <span className="absolute -right-2 -top-1.5 flex h-[18px] min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FF5500] px-1 text-[10px] font-black text-white shadow-sm shadow-[#FF5500]/60">
                {totalFavorites}
              </span>
            )}
          </Link>

          <button
            onClick={() => setIsCartOpen(true)}
            className="group relative flex items-center justify-center p-1 text-white transition-colors hover:text-[#FF5500] focus:outline-none"
            aria-label="Abrir carrinho"
          >
            <ShoppingBag size={22} strokeWidth={1.9} />

            {totalItems > 0 && (
              <span className="absolute -right-2 -top-1.5 flex h-[18px] min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FF5500] px-1 text-[10px] font-black text-white shadow-sm shadow-[#FF5500]/60">
                {totalItems}
              </span>
            )}
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            className="p-2 text-white transition-colors hover:text-[#FF5500] xl:hidden"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="absolute left-0 right-0 top-full z-40 space-y-3 border-b border-white/10 bg-[#121212] px-4 py-4 shadow-lg xl:hidden">
          <form onSubmit={handleSearch} className="relative flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar produtos..."
              className="w-full rounded-lg border border-white/10 bg-[#181818] py-2 pl-10 pr-3 text-sm text-white placeholder-zinc-500 focus:border-[#FF5500] focus:outline-none"
            />
            <Search className="absolute left-3 text-zinc-500" size={16} />
          </form>

          <nav aria-label="Categorias" className="grid grid-cols-2 gap-2 border-b border-white/10 pb-3 text-xs font-semibold uppercase">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`rounded-md px-2.5 py-2.5 transition-colors ${
                  pathname === item.href || item.label === 'Ofertas'
                    ? 'text-[#FF5500]'
                    : 'text-white hover:text-[#FF5500]'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="grid grid-cols-2 gap-2 pt-1 text-xs font-medium">
            {customer ? (
              <>
                <Link
                  href="/conta"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 rounded-md border border-white/10 bg-[#181818] p-2.5 text-white"
                >
                  <User size={16} className="text-[#FF6500]" /> Olá, {customerName}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void handleLogout();
                  }}
                  className="flex items-center gap-2 rounded-md border border-white/10 bg-[#181818] p-2.5 text-white"
                >
                  <LogOut size={16} className="text-[#FF6500]" /> Sair
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsLoginOpen(true);
                }}
                className="flex items-center gap-2 rounded-md border border-white/10 bg-[#181818] p-2.5 text-white"
              >
                <User size={16} className="text-[#FF6500]" /> Entrar / Conta
              </button>
            )}
            <Link
              href="/conta/favoritos"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 rounded-md border border-white/10 bg-[#181818] p-2.5 text-white"
            >
              <Heart size={16} className="text-[#FF6500]" /> Favoritos
            </Link>
            <Link
              href="/admin/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="col-span-2 flex items-center justify-center rounded-md border border-[#FF5500]/30 bg-[#FF5500]/10 p-2.5 font-bold text-[#FF5500]"
            >
              Painel Administrativo
            </Link>
          </div>
        </div>
      )}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onAuthenticated={handleAuthenticated}
      />
    </header>
  );
}