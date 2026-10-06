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
    <section className="border-b border-white/10 bg-[#0A0A0A] py-3 select-none overflow-hidden relative">
      {/* 1. VERSÃO DESKTOP (Grid estático elegante de 5 colunas) */}
      <div className="hidden lg:block max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-5 gap-8 items-center justify-between text-xs">
          {BENEFITS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="flex items-center gap-3">
                <Icon size={20} className="text-white/80 flex-shrink-0" />
                <div>
                  <p className="font-bold text-white leading-tight">{item.title}</p>
                  <p className="text-[11px] text-zinc-400">{item.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. VERSÃO MOBILE (Barra contínua animada em movimento estilo 'Portal de Notícias' / Ticker) */}
      <div className="block lg:hidden relative w-full overflow-hidden">
        {/* Sombras suaves nas bordas para transição perfeita */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#0A0A0A] to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#0A0A0A] to-transparent z-10" />

        {/* Ticker contínuo infinito */}
        <div className="animate-marquee items-center gap-6 text-xs whitespace-nowrap py-0.5">
          {/* Duplicado para loop infinito 100% fluido */}
          {[...BENEFITS, ...BENEFITS].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="flex items-center gap-2.5 px-3 flex-shrink-0">
                <Icon size={16} className="text-[#FF6500] flex-shrink-0" />
                <span className="font-bold text-white text-xs">{item.title}</span>
                <span className="text-zinc-500 text-[11px] font-medium">• {item.subtitle}</span>
                <span className="text-zinc-700 ml-3 text-xs">|</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
