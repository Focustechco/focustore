'use client';

import React from 'react';
import { Truck, CreditCard, ShieldCheck, Gift, Headphones } from 'lucide-react';

const BENEFITS = [
  {
    icon: Truck,
    title: 'Frete para todo o Brasil',
    subtitle: 'Rápido e seguro',
  },
  {
    icon: CreditCard,
    title: 'Até 12x no cartão',
    subtitle: 'Parcelamento facilitado',
  },
  {
    icon: ShieldCheck,
    title: 'Compra segura',
    subtitle: 'Seus dados protegidos',
  },
  {
    icon: Gift,
    title: 'Produtos exclusivos',
    subtitle: 'Design Focus Tech',
  },
  {
    icon: Headphones,
    title: 'Suporte especializado',
    subtitle: 'Fale com nosso time',
  },
];

export function BenefitsBar() {
  return (
    <section className="relative select-none overflow-hidden border-b border-white/10 bg-[#0A0A0A] py-2 text-white">
      {/* 1. VERSÃO DESKTOP (Grid estático elegante de 5 colunas) */}
      <div className="mx-auto hidden max-w-[1800px] px-4 sm:px-6 xl:block xl:px-10">
        <div className="grid grid-cols-5 items-center justify-between text-xs">
          {BENEFITS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className={`flex items-center gap-4 px-5 ${idx > 0 ? 'border-l border-white/15' : ''}`}
              >
                <Icon size={24} strokeWidth={1.8} className="flex-shrink-0 text-white" />
                <div>
                  <p className="whitespace-nowrap text-[11px] font-bold leading-tight text-white">
                    {item.title}
                  </p>
                  <p className="mt-0.5 whitespace-nowrap text-[11px] text-zinc-400">
                    {item.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. VERSÃO MOBILE (Barra contínua animada em movimento estilo 'Portal de Notícias' / Ticker) */}
      <div className="relative block w-full overflow-hidden xl:hidden">
        {/* Sombras suaves nas bordas para transição perfeita */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[#0A0A0A] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#0A0A0A] to-transparent" />

        {/* Ticker contínuo infinito */}
        <div className="animate-marquee items-center gap-6 whitespace-nowrap py-0.5 text-xs">
          {/* Duplicado para loop infinito 100% fluido */}
          {[...BENEFITS, ...BENEFITS].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="flex items-center gap-2.5 px-3 flex-shrink-0">
                <Icon size={16} className="flex-shrink-0 text-[#FF6500]" />
                <span className="text-[11px] font-bold text-white">{item.title}</span>
                <span className="text-[11px] font-medium text-zinc-400">• {item.subtitle}</span>
                <span className="ml-3 text-xs text-zinc-700">|</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
