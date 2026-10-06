import React from 'react';
import { cn } from '@/lib/utils/formatters';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth = false, children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center font-medium transition-all duration-200 rounded-md focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

    const variants = {
      primary: 'bg-focus text-white hover:bg-focus-hover shadow-focus/30 shadow-sm border border-transparent font-semibold',
      secondary: 'bg-surface text-white hover:bg-surface-hover border border-white/10',
      outline: 'bg-transparent text-white border border-white/20 hover:border-focus hover:text-focus',
      ghost: 'bg-transparent text-muted hover:text-white hover:bg-surface/60',
      danger: 'bg-red-600/90 text-white hover:bg-red-600 border border-red-500/20',
    };

    const sizes = {
      sm: 'text-xs px-3 py-1.5 gap-1.5 h-8',
      md: 'text-sm px-5 py-2.5 gap-2 h-11',
      lg: 'text-base px-7 py-3.5 gap-2.5 h-13 tracking-wide',
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';