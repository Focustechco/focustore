'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CartItem {
  variantId: string;
  productId: string;
  name: string;
  variantName: string;
  price: number;
  promotionalPrice?: number | null;
  imageUrl?: string | null;
  sku: string;
  quantity: number;
  size?: string | null;
  color?: string | null;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const REAL_PRODUCT_IMAGES: Record<string, string> = {
  'moletom': '/images/products/moletom-focus-hoodie.jpg',
  'hoodie': '/images/products/moletom-focus-hoodie.jpg',
  'polo': '/images/products/polo-focus.jpg',
  'camisa': '/images/products/camiseta-focus.jpg',
  'bone': '/images/products/bone-focus.jpg',
  'boné': '/images/products/bone-focus.jpg',
  'garrafa': '/images/products/garrafa-focus.jpg',
  'celular': '/images/products/suporte-celular-focus.jpg',
  'headphone': '/images/products/suporte-headphone-focus.jpg',
  'sticker': '/images/products/stickers-focus.jpg',
  'adesivo': '/images/products/stickers-focus.jpg',
  'chaveiro': '/images/products/chaveiros-focus-kit.jpg',
  'copo': '/images/products/copo-termico-focus.jpg',
  'mousepad': '/images/products/mousepad-focus.jpg',
  'desk mat': '/images/products/mousepad-focus.jpg',
  'canetas': '/images/products/kit-canetas-focus.jpg',
  'caneta': '/images/products/caneta-focus-black.png',
  'caneca': '/images/products/caneca-focus.jpg',
};

export function resolveProductImage(imageUrl?: string | null, name?: string): string {
  if (imageUrl && imageUrl.startsWith('/images/products/')) {
    return imageUrl;
  }
  const lower = (name || '').toLowerCase();
  for (const [key, path] of Object.entries(REAL_PRODUCT_IMAGES)) {
    if (lower.includes(key)) return path;
  }
  return imageUrl || '/images/products/camiseta-focus.jpg';
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('focus_cart');
      if (saved) {
        const parsed: CartItem[] = JSON.parse(saved);
        const updated = parsed.map((item) => ({
          ...item,
          imageUrl: resolveProductImage(item.imageUrl, item.name),
        }));
        setItems(updated);
      }
    } catch (e) {
      console.error(e);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      try {
        localStorage.setItem('focus_cart', JSON.stringify(items));
      } catch (e) {
        console.error(e);
      }
    }
  }, [items, mounted]);

  const addItem = (rawItem: CartItem) => {
    const newItem: CartItem = {
      ...rawItem,
      imageUrl: resolveProductImage(rawItem.imageUrl, rawItem.name),
    };
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === newItem.variantId);
      if (existing) {
        return prev.map((i) =>
          i.variantId === newItem.variantId
            ? { ...i, quantity: i.quantity + newItem.quantity }
            : i
        );
      }
      return [...prev, newItem];
    });
    setIsCartOpen(true);
  };

  const removeItem = (variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  };

  const updateQuantity = (variantId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(variantId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.variantId === variantId ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => {
    setItems([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('focus_cart');
    }
  };

  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = items.reduce(
    (acc, item) => acc + (item.promotionalPrice || item.price) * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        subtotal,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}