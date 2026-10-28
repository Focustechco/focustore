'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Heart, User, Menu, X, LogOut, ShoppingBag, ChevronRight } from 'lucide-react';
import { useCart } from '@/modules/cart/cart-context';
import { useFavorites } from '@/modules/favorites/favorites-context';
import { FocusLogo } from '@/components/ui/focus-logo';
import { LoginModal, type CustomerSession } from '@/components/layout/login-modal';

const NAV_ITEMS = [
  { label: 'Todos', href: '/categoria/todos' },
  { label: 'Vestuário', href: '/categoria/vestuario' },
  { label: 'Acessórios', href: '/categoria/acessorios' },
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
  const navRef = React.useRef<HTMLElement>(null);
  const navItemRefs = React.useRef<(HTMLAnchorElement | null)[]>([]);
  const searchFormRef = React.useRef<HTMLFormElement>(null);
  const [coveredNavItems, setCoveredNavItems] = useState<number[]>([]);

  useEffect(() => {
    if (!isSearchOpen) {
      setCoveredNavItems([]);
      return;
    }

    const updateCoveredNavItems = () => {
      const searchBounds = searchFormRef.current?.getBoundingClientRect();
      if (!searchBounds) return;

      setCoveredNavItems(
        navItemRefs.current.flatMap((item, index) => {
          if (!item) return [];
          const itemBounds = item.getBoundingClientRect();
          const overlaps =
            itemBounds.left < searchBounds.right &&
            itemBounds.right > searchBounds.left &&
            itemBounds.top < searchBounds.bottom &&
            itemBounds.bottom > searchBounds.top;
          return overlaps ? [index] : [];
        }),
      );
    };

    updateCoveredNavItems();
    window.addEventListener('resize', updateCoveredNavItems);
    const resizeObserver = new ResizeObserver(updateCoveredNavItems);
    if (navRef.current) resizeObserver.observe(navRef.current);
    if (searchFormRef.current) resizeObserver.observe(searchFormRef.current);

    return () => {
      window.removeEventListener('resize', updateCoveredNavItems);
      resizeObserver.disconnect();
    };
  }, [isSearchOpen]);

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

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

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
          <FocusLogo size="xl" mobileSize="md" />
        </Link>

        <nav ref={navRef} aria-label="Categorias" className="hidden flex-1 items-center justify-center gap-5 xl:flex xl:-translate-x-3 2xl:gap-8">
          {NAV_ITEMS.map((item, index) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                ref={(element) => {
                  navItemRefs.current[index] = element;
                }}
                href={item.href}
                aria-hidden={coveredNavItems.includes(index)}
                tabIndex={coveredNavItems.includes(index) ? -1 : undefined}
                className={`${coveredNavItems.includes(index) ? 'invisible pointer-events-none' : ''} whitespace-nowrap text-[11px] font-semibold uppercase transition-colors 2xl:text-xs ${
                  item.label === 'Ofertas'
                    ? 'text-white hover:text-[#FF5500]'
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
          <div className="relative h-8 w-8 flex-shrink-0">
            {!isSearchOpen ? (
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                aria-label="Buscar produtos"
                aria-expanded={false}
                className="flex h-full w-full items-center justify-center transition-colors hover:text-[#FF5500]"
              >
                <Search size={22} strokeWidth={2.2} />
              </button>
            ) : (
              <form
                ref={searchFormRef}
                onSubmit={handleSearch}
                className="animate-search-appear absolute right-0 top-1/2 z-50 flex w-[min(40vw,280px)] -translate-y-1/2 items-center rounded-full border border-white/15 bg-[#121212] px-4 py-1 shadow-xl transition-colors focus-within:border-[#FF5500] max-sm:fixed max-sm:left-2 max-sm:right-auto max-sm:top-[38px] max-sm:w-[calc(100vw-170px)] max-sm:translate-y-[-50%] max-sm:px-3"
              >
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar produtos..."
                  aria-label="Buscar produtos"
                  className="w-full min-w-0 bg-transparent py-1 text-sm text-white outline-none placeholder:text-zinc-500"
                />
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  aria-label="Fechar busca"
                  className="ml-2 flex-shrink-0 text-zinc-400 transition-colors hover:text-[#FF5500]"
                >
                  <X size={18} />
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
            className="relative z-[60] p-2 text-white transition-colors hover:text-[#FF5500] xl:hidden"
          >
            {!mobileMenuOpen && <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex h-[100dvh] flex-col overflow-y-auto bg-[#080808] px-5 pb-5 xl:hidden">
          <div className="flex h-[76px] flex-shrink-0 items-center justify-between border-b border-white/10">
            <FocusLogo size="xl" mobileSize="md" />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Fechar menu"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white transition-colors hover:border-[#FF5500]/50 hover:text-[#FF5500]"
            >
              <X size={22} />
            </button>
          </div>

          <nav aria-label="Categorias" className="mt-5 flex flex-col">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`group flex items-center justify-between border-b border-white/10 py-4 transition-colors ${
                  item.label === 'Ofertas'
                    ? 'text-white hover:text-[#FF5500]'
                    : pathname === item.href
                    ? 'text-[#FF5500]'
                    : 'text-white hover:text-[#FF5500]'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="text-[15px] font-black uppercase tracking-[0.08em]">{item.label}</span>
                </span>
                <ChevronRight size={18} className="text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-[#FF5500]" />
              </Link>
            ))}
          </nav>

          <div className="grid grid-cols-2 gap-3 pt-5 text-xs font-bold uppercase">
            {customer ? (
              <Link
                href="/conta"
                onClick={() => setMobileMenuOpen(false)}
                className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#181818] px-3 text-center text-white"
              >
                <User size={16} className="text-[#FF6500]" />
                Minha Conta
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsLoginOpen(true);
                }}
                className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#181818] px-3 text-white"
              >
                <User size={16} className="text-[#FF6500]" /> Entrar / Conta
              </button>
            )}
            <Link
              href="/admin/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="flex min-h-12 items-center justify-center rounded-lg border border-[#FF5500]/30 bg-[#FF5500]/10 px-3 text-center font-bold text-[#FF5500]"
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