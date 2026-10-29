'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function BackToHomeButton() {
  const pathname = usePathname();

  if (pathname === '/') return null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6 lg:px-8 sm:pt-7">
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-200 transition-colors hover:border-[#FF6500]/60 hover:bg-[#FF6500]/10 hover:text-white"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Voltar para o início
      </Link>
    </div>
  );
}
