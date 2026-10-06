'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { resolveProductImage } from '@/modules/cart/cart-context';

export interface FavoriteProduct {
  id: string;
  name: string;
  slug: string;
  brand?: string;
  basePrice: number;
  promotionalPrice?: number | null;
  imageUrl?: string;
  shortDescription?: string | null;
  categories?: { category: { name: string; slug: string } }[];
  variants?: any[];
  images?: { url: string; altText?: string | null }[];
}

interface FavoritesContextType {
  favorites: FavoriteProduct[];
  toggleFavorite: (product: FavoriteProduct) => boolean; // returns true if added, false if removed
  isFavorite: (productId: string) => boolean;
  removeFavorite: (productId: string) => void;
  clearFavorites: () => void;
  totalFavorites: number;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('focus_favorites');
      if (saved) {
        const parsed: FavoriteProduct[] = JSON.parse(saved);
        const updated = parsed.map((item) => ({
          ...item,
          imageUrl: resolveProductImage(item.imageUrl || item.images?.[0]?.url, item.name),
        }));
        setFavorites(updated);
      }
    } catch (e) {
      console.error('Error loading favorites from localStorage:', e);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      try {
        localStorage.setItem('focus_favorites', JSON.stringify(favorites));
      } catch (e) {
        console.error('Error saving favorites to localStorage:', e);
      }
    }
  }, [favorites, mounted]);

  const isFavorite = (productId: string): boolean => {
    return favorites.some((item) => item.id === productId || item.slug === productId);
  };

  const toggleFavorite = (product: FavoriteProduct): boolean => {
    const existingIndex = favorites.findIndex(
      (item) => item.id === product.id || item.slug === product.slug
    );

    if (existingIndex >= 0) {
      // Remover
      setFavorites((prev) => prev.filter((_, idx) => idx !== existingIndex));
      return false;
    } else {
      // Adicionar
      const normalizedProduct: FavoriteProduct = {
        id: product.id,
        name: product.name,
        slug: product.slug,
        brand: product.brand || 'FOCUS®',
        basePrice: product.basePrice,
        promotionalPrice: product.promotionalPrice,
        imageUrl: resolveProductImage(product.imageUrl || product.images?.[0]?.url, product.name),
        shortDescription: product.shortDescription,
        categories: product.categories,
        variants: product.variants,
        images: product.images,
      };
      setFavorites((prev) => [normalizedProduct, ...prev]);
      return true;
    }
  };

  const removeFavorite = (productId: string) => {
    setFavorites((prev) => prev.filter((item) => item.id !== productId && item.slug !== productId));
  };

  const clearFavorites = () => {
    setFavorites([]);
  };

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        toggleFavorite,
        isFavorite,
        removeFavorite,
        clearFavorites,
        totalFavorites: favorites.length,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}
