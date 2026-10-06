import React from 'react';
import { formatPrice, cn } from '@/lib/utils/formatters';

interface PriceProps {
  price: number;
  promotionalPrice?: number | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Price({ price, promotionalPrice, className, size = 'md' }: PriceProps) {
  const hasDiscount = promotionalPrice !== undefined && promotionalPrice !== null && promotionalPrice < price;

  const sizeClasses = {
    sm: 'text-sm font-medium',
    md: 'text-base font-semibold',
    lg: 'text-xl font-bold',
    xl: 'text-3xl font-bold tracking-tight',
  };

  return (
    <div className={cn('flex items-baseline gap-2', className)}>
      <span className={cn('text-white', sizeClasses[size])}>
        {formatPrice(hasDiscount ? promotionalPrice : price)}
      </span>
      {hasDiscount && (
        <span className="text-xs sm:text-sm text-muted line-through font-normal">
          {formatPrice(price)}
        </span>
      )}
    </div>
  );
}