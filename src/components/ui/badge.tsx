import React from 'react';
import { cn } from '@/lib/utils/formatters';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'focus' | 'secondary' | 'success' | 'outline';
  className?: string;
}

export function Badge({ children, variant = 'focus', className }: BadgeProps) {
  const variants = {
    focus: 'bg-focus/15 text-focus border-focus/30',
    secondary: 'bg-surface text-muted-light border-white/10',
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    outline: 'bg-transparent text-muted border-white/20',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded border tracking-wider uppercase',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}