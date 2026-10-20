'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/formatters';

const NAV_ITEMS = [
  { label: 'Todos', href: '/categoria/todos' },
  { label: 'Vestuário', href: '/categoria/vestuario' },
  { label: 'Acessórios', href: '/categoria/acessorios' },
  { label: 'Tecnologia', href: '/categoria/tecnologia' },
  { label: 'Lifestyle', href: '/categoria/lifestyle' },
  { label: 'Coleções', href: '/colecoes' },
  { label: 'Ofertas', href: '/categoria/ofertas' },
];

export function NavigationBar() {
  const pathname = usePathname();

  return (
    <nav className="overflow-x-auto border-b border-white/10 bg-[#101010] scrollbar-none xl:hidden">
      <div className="mx-auto flex h-11 max-w-[1800px] items-center justify-start gap-5 whitespace-nowrap px-4 text-xs font-semibold uppercase tracking-wider sm:justify-center sm:gap-8 sm:px-6 lg:px-10">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative py-3.5 transition-colors duration-200 group flex items-center',
                isActive
                  ? 'text-[#FF6500] font-bold'
                  : 'text-zinc-400 hover:text-[#FF5500]'
              )}
            >
              <span className="transition-transform duration-200 group-hover:-translate-y-0.5">
                {item.label}
              </span>
              <span
                className={cn(
                  'absolute bottom-0 inset-x-0 h-0.5 rounded-full bg-[#FF5500] transition-all duration-300',
                  isActive
                    ? 'opacity-100 scale-x-100'
                    : 'opacity-0 scale-x-0 group-hover:opacity-100 group-hover:scale-x-100'
                )}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}