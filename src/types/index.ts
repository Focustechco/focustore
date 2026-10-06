export type UserRole = 'CUSTOMER' | 'MANAGER' | 'ADMIN';

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type OrderStatus =
  | 'PENDING'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'BOLETO';

export type MovementType =
  | 'IN'
  | 'OUT'
  | 'RESERVE'
  | 'RELEASE'
  | 'ADJUSTMENT'
  | 'RETURN';

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';

export interface CartItemWithProduct {
  id: string;
  variantId: string;
  quantity: number;
  variant: {
    id: string;
    name: string;
    sku: string;
    price: number;
    promotionalPrice?: number | null;
    color?: string | null;
    colorHex?: string | null;
    size?: string | null;
    imageUrl?: string | null;
    product: {
      id: string;
      name: string;
      slug: string;
      brand: string;
    };
    inventory?: {
      quantityAvailable: number;
      quantityReserved: number;
    } | null;
  };
}

export interface ShippingOption {
  carrier: string;
  serviceName: string;
  price: number;
  estimatedDays: number;
}
