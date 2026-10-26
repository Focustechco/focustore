import React from 'react';
import { cn } from '@/lib/utils/formatters';

interface FocusLogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  mobileSize?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  priority?: boolean;
  variant?: 'dark' | 'light';
}

export function FocusLogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn('w-full h-full fill-[#FF6500]', className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 4 Curved Aperture Vortex Blades */}
      <g fill="#FF6500">
        <path d="M 50 8 C 68 8, 84 20, 88 38 C 76 34, 62 38, 54 48 C 50 42, 44 32, 50 8 Z" />
        <path d="M 92 50 C 92 68, 80 84, 62 88 C 66 76, 62 62, 52 54 C 58 50, 68 44, 92 50 Z" />
        <path d="M 50 92 C 32 92, 16 80, 12 62 C 24 66, 38 62, 46 52 C 50 58, 56 68, 50 92 Z" />
        <path d="M 8 50 C 8 32, 20 16, 38 12 C 34 24, 38 38, 48 46 C 42 50, 32 56, 8 50 Z" />
      </g>
    </svg>
  );
}

export function FocusLogo({
  className,
  iconOnly = false,
  size = '3xl',
  mobileSize,
  priority = true,
  variant = 'dark',
}: FocusLogoProps) {
  const heights = {
    sm: 'h-4 max-h-[18px]',
    md: 'h-5 sm:h-6 max-h-[24px]',
    lg: 'h-6 sm:h-7 max-h-[28px]',
    xl: 'h-7 sm:h-8 max-h-[34px]',
    '2xl': 'h-9 sm:h-10 max-h-[42px]',
    '3xl': 'h-10 sm:h-12 max-h-[48px]',
  };

  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-12 h-12',
    '2xl': 'w-16 h-16',
    '3xl': 'w-20 h-20',
  };

  const mobileHeights = {
    sm: 'h-4 max-h-[18px]',
    md: 'h-5 max-h-[24px]',
    lg: 'h-6 max-h-[28px]',
    xl: 'h-7 max-h-[34px]',
    '2xl': 'h-9 max-h-[42px]',
    '3xl': 'h-10 max-h-[48px]',
  };

  const desktopHeights = {
    sm: 'sm:h-4 sm:max-h-[18px]',
    md: 'sm:h-6 sm:max-h-[24px]',
    lg: 'sm:h-7 sm:max-h-[28px]',
    xl: 'sm:h-8 sm:max-h-[34px]',
    '2xl': 'sm:h-10 sm:max-h-[42px]',
    '3xl': 'sm:h-12 sm:max-h-[48px]',
  };

  if (iconOnly) {
    return (
      <div className={cn('relative inline-flex items-center justify-center flex-shrink-0 select-none group', iconSizes[size], className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/focus-vortex-icon.png"
          alt="Focus Vortex"
          className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-110 drop-shadow-md"
          loading={priority ? 'eager' : 'lazy'}
        />
      </div>
    );
  }

  const logoSrc = variant === 'light' ? '/brand/focus-store-logo-light.png' : '/brand/focus-store-logo.png';

  return (
    <div className={cn('relative inline-flex items-center select-none group', className)}>
      {/* Imagem Oficial FOCUS STORE em Alta Resolução */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoSrc}
        alt="FOCUS STORE®"
        className={cn(
          'w-auto object-contain transition-transform duration-300 group-hover:scale-105',
          mobileSize ? `${mobileHeights[mobileSize]} ${desktopHeights[size]}` : heights[size]
        )}
        loading={priority ? 'eager' : 'lazy'}
      />
    </div>
  );
}