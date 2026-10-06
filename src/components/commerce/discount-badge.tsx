import React from 'react';
import { cn } from '@/lib/utils/formatters';

export function DiscountBadge({ price, promotionalPrice, className }: { price: number; promotionalPrice: number; className?: string }) {
  if (!promotionalPrice || promotionalPrice >= price) return null;
  const percentage = Math.round(((price - promotionalPrice) / price) * 100);

  return (
    <span
      className={cn(
        'bg-focus text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm tracking-wider uppercase',
        className
      )}
    >
      -{percentage}%
    </span>
  );
}