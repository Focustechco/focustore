'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { restoredCart } from './cart-validation';

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
  quoteError: string | null;
  isQuoting: boolean;
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
  'chaveiro': '/images/products/chaveiro-focus.jpg',
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
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const lastQuotedSignature = useRef('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('focus_cart');
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        const validLines = restoredCart(parsed);
        const updated = validLines.map((line) => {
          const original = (parsed as CartItem[]).find((item) => item.variantId === line.variantId);
          return {
            ...(original || {}),
            variantId: line.variantId,
            quantity: line.quantity,
            name: original?.name || 'Produto',
            imageUrl: resolveProductImage(original?.imageUrl, original?.name),
          } as CartItem;
        });
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

  useEffect(() => {
    if (!mounted) return;
    const signature = items
      .map((item) => `${item.variantId}:${item.quantity}`)
      .sort()
      .join('|');
    if (!signature) {
      setQuoteError(null);
      setIsQuoting(false);
      lastQuotedSignature.current = '';
      return;
    }
    if (signature === lastQuotedSignature.current) return;
    lastQuotedSignature.current = signature;
    const controller = new AbortController();
    setIsQuoting(true);
    setQuoteError(null);
    fetch('/api/cart/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        items: items.map(({ variantId, quantity }) => ({ variantId, quantity })),
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.detail || data?.error || 'Não foi possível validar o carrinho.');
        }
        return data as { items: { variant_id: string; unit_price: number | string; quantity: number }[] };
      })
      .then((quote) => {
        const prices = new Map(quote.items.map((line) => [line.variant_id, Number(line.unit_price)]));
        setItems((current) => current.map((item) => {
          const unitPrice = prices.get(item.variantId);
          return unitPrice === undefined ? item : { ...item, price: unitPrice, promotionalPrice: null };
        }));
        setQuoteError(null);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setQuoteError(error instanceof Error ? error.message : 'Não foi possível validar o carrinho.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsQuoting(false);
      });
    return () => controller.abort();
  }, [items, mounted]);

  const addItem = (rawItem: CartItem) => {
    const quantity = Number.isSafeInteger(rawItem.quantity)
      ? Math.min(999, Math.max(1, rawItem.quantity))
      : 1;
    const newItem: CartItem = {
      ...rawItem,
      quantity,
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
    quantity = Math.min(999, Math.floor(quantity));
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
        quoteError,
        isQuoting,
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
