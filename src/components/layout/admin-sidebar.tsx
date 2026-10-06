'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Layers,
  ShoppingBag,
  Users,
  Warehouse,
  Ticket,
  Image as ImageIcon,
  ShieldCheck,
  Store,
  Settings,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils/formatters';
import { FocusLogo } from '@/components/ui/focus-logo';

interface NavGroup {
  groupName: string;
  items: {
    label: string;
    href: string;
    icon: any;
    badge?: string;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupName: 'VISÃO GERAL',
    items: [
      { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    groupName: 'CATÁLOGO & CMS',
    items: [
      { label: 'Produtos', href: '/admin/produtos', icon: Package },
      { label: 'Categorias', href: '/admin/categorias', icon: Layers },
      { label: 'Banners & Fotos', href: '/admin/banners', icon: ImageIcon },
      { label: 'Cupons & Descontos', href: '/admin/cupons', icon: Ticket },
    ],
  },
  {
    groupName: 'VENDAS & LOGÍSTICA',
    items: [
      { label: 'Pedidos', href: '/admin/pedidos', icon: ShoppingBag },
      { label: 'Estoque & Reservas', href: '/admin/estoque', icon: Warehouse },
      { label: 'Clientes', href: '/admin/clientes', icon: Users },
    ],
  },
  {
    groupName: 'SISTEMA',
    items: [
      { label: 'Auditoria & Logs', href: '/admin/auditoria', icon: ShieldCheck },
      { label: 'Configurações', href: '/admin/configuracoes', icon: Settings },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Load persistence state for desktop sidebar
  useEffect(() => {
    const saved = localStorage.getItem('focus_admin_sidebar_collapsed');
    if (saved !== null) {
      setIsCollapsed(saved === 'true');
    }
  }, []);

  // Fechar menu mobile ao navegar de rota
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('focus_admin_sidebar_collapsed', String(next));
      return next;
    });
  };

  return (
    <>
      {/* =========================================================
          1. BARRA SUPERIOR MOBILE (Apenas telas menores que lg)
          ========================================================= */}
      <header className="lg:hidden sticky top-0 z-40 bg-[#090909]/95 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard" className="flex items-center">
            <FocusLogo size="xl" priority />
          </Link>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FF6500]/15 text-[#FF6500] border border-[#FF6500]/30 uppercase">
            Admin
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            target="_blank"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            title="Ver Loja"
          >
            <Store size={18} />
          </Link>
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-2 rounded-xl bg-[#FF6500]/10 border border-[#FF6500]/30 text-[#FF6500] hover:bg-[#FF6500] hover:text-white transition-all focus:outline-none"
            aria-label="Abrir Menu Administrativo"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* =========================================================
          2. MENU DRAWER MOBILE (Gaveta deslizante com Hambúrguer)
          ========================================================= */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop Escuro com Blur */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileOpen(false)}
          />

          {/* Painel do Menu */}
          <div className="relative w-72 max-w-[85vw] bg-[#0A0A0A] border-r border-white/15 h-full flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {/* Header da Gaveta */}
            <div className="px-4 py-3.5 border-b border-white/10 bg-gradient-to-b from-[#141414] to-transparent flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FocusLogo size="2xl" priority />
              </div>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                aria-label="Fechar Menu"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navegação da Gaveta */}
            <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
              {NAV_GROUPS.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1">
                  <span className="px-3 text-[10px] font-mono font-bold tracking-widest text-zinc-500 uppercase block truncate">
                    {group.groupName}
                  </span>

                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive =
                        pathname === item.href ||
                        (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsMobileOpen(false)}
                          className={cn(
                            'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200',
                            isActive
                              ? 'bg-[#FF6500] text-white shadow-lg shadow-[#FF6500]/25 font-bold'
                              : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Icon
                              size={18}
                              className={cn(
                                'flex-shrink-0',
                                isActive ? 'text-white' : 'text-zinc-400'
                              )}
                            />
                            <span className="truncate">{item.label}</span>
                          </div>

                          {isActive ? (
                            <ChevronRight size={14} className="text-white/80 flex-shrink-0" />
                          ) : item.badge ? (
                            <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-zinc-300 font-mono">
                              {item.badge}
                            </span>
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* Footer da Gaveta */}
            <div className="p-3 border-t border-white/10 bg-[#0C0C0C]">
              <Link
                href="/"
                target="_blank"
                onClick={() => setIsMobileOpen(false)}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-[#FF6500]/10 border border-white/5 hover:border-[#FF6500]/30 text-xs font-semibold text-zinc-300 hover:text-[#FF6500] transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Store size={16} className="text-[#FF6500] flex-shrink-0" />
                  <span>Ver Loja Virtual</span>
                </div>
                <ExternalLink size={13} className="text-zinc-500" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          3. SIDEBAR FIXA DESKTOP (Apenas visível em telas lg ou maiores)
          ========================================================= */}
      <aside
        className={cn(
          'hidden lg:flex bg-[#090909] border-r border-white/10 flex-col h-screen sticky top-0 select-none transition-all duration-300 z-40 print:hidden',
          isCollapsed ? 'w-20' : 'w-72'
        )}
      >
        {/* Header Desktop com Logo & Botão de Colapso */}
        <div className="px-4 py-3.5 border-b border-white/10 bg-gradient-to-b from-[#121212]/80 to-transparent flex items-center justify-between">
          {!isCollapsed ? (
            <>
              <Link
                href="/admin/dashboard"
                className="flex items-center group transition-all overflow-hidden py-1"
              >
                <FocusLogo size="3xl" priority />
              </Link>

              <button
                onClick={toggleCollapse}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors flex-shrink-0"
                title="Recolher Menu"
              >
                <ChevronLeft size={16} strokeWidth={2} />
              </button>
            </>
          ) : (
            <div className="w-full flex flex-col items-center gap-2.5 py-1">
              <Link
                href="/admin/dashboard"
                className="flex items-center justify-center p-1 rounded-xl hover:bg-white/5 transition-all group"
                title="Focus Store Admin"
              >
                <FocusLogo iconOnly size="xl" priority />
              </Link>

              <button
                onClick={toggleCollapse}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                title="Expandir Menu"
              >
                <ChevronRight size={16} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>

        {/* Navegação Desktop Agrupada por Módulos */}
        <nav className="flex-1 px-3 pt-3 pb-4 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
          {NAV_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {!isCollapsed && (
                <span className="px-3 text-[10px] font-mono font-bold tracking-widest text-zinc-500 uppercase block truncate">
                  {group.groupName}
                </span>
              )}

              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'group relative flex items-center rounded-xl text-xs font-semibold tracking-wide transition-all duration-200',
                        isCollapsed
                          ? 'justify-center p-3'
                          : 'justify-between px-3.5 py-2.5',
                        isActive
                          ? 'bg-[#FF6500] text-white shadow-lg shadow-[#FF6500]/25 font-bold'
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          size={18}
                          className={cn(
                            'transition-transform duration-200 group-hover:scale-110 flex-shrink-0',
                            isActive ? 'text-white' : 'text-zinc-400 group-hover:text-[#FF6500]'
                          )}
                        />
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </div>

                      {!isCollapsed && (
                        <>
                          {isActive ? (
                            <ChevronRight size={14} className="text-white/80 flex-shrink-0" />
                          ) : item.badge ? (
                            <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-zinc-300 font-mono">
                              {item.badge}
                            </span>
                          ) : null}
                        </>
                      )}

                      {/* Tooltip no modo colapsado */}
                      {isCollapsed && (
                        <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-[#141414] border border-white/15 text-white text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-xl z-50">
                          {item.label}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer Desktop com Acesso Direto à Loja */}
        <div className="p-3 border-t border-white/10 bg-[#0C0C0C]">
          <Link
            href="/"
            target="_blank"
            className={cn(
              'flex items-center rounded-xl bg-white/5 hover:bg-[#FF6500]/10 border border-white/5 hover:border-[#FF6500]/30 text-xs font-semibold text-zinc-300 hover:text-[#FF6500] transition-all group relative',
              isCollapsed ? 'justify-center p-3' : 'justify-between px-3.5 py-2.5'
            )}
          >
            <div className="flex items-center gap-2.5">
              <Store size={16} className="text-[#FF6500] flex-shrink-0" />
              {!isCollapsed && <span>Ver Loja</span>}
            </div>
            {!isCollapsed && (
              <ExternalLink size={13} className="text-zinc-500 group-hover:text-[#FF6500] transition-colors" />
            )}

            {isCollapsed && (
              <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-[#141414] border border-white/15 text-white text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-xl z-50">
                Ver Loja Virtual
              </div>
            )}
          </Link>
        </div>
      </aside>
    </>
  );
}