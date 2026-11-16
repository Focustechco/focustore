/** Shared boundary types. Prisma IDs and PostgreSQL public IDs are not interchangeable. */
export type CatalogSource = 'prisma' | 'fastapi';
export type PublicUuid = string & { readonly __brand: 'FocusStorePublicUuid' };
export type HttpStatus = 401 | 403 | 404 | 409 | 422 | 429 | 503;

export type ApiErrorBody = { detail?: string; code?: string };

export type FastApiOrderStatus = 'pending_payment' | 'paid' | 'cancelled' | 'expired';
export type FastApiPaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled';

export interface FastApiUser {
  id: string;
  name: string | null;
  email: string;
  role: 'CUSTOMER' | 'MANAGER' | 'ADMIN';
}

export interface FastApiShippingOption {
  carrier: string;
  service_name: string;
  amount: string;
  days: number;
}

export interface FastApiOrderItem {
  variant_public_id: PublicUuid;
  product_name: string;
  variant_name: string;
  sku: string;
  unit_price: string;
  quantity: number;
  line_total: string;
}

export interface FastApiOrder {
  public_id: PublicUuid;
  status: FastApiOrderStatus;
  currency: string;
  subtotal: string;
  discount_amount: string;
  shipping_amount: string;
  total: string;
  shipping_option: string;
  created_at: string;
  updated_at: string;
  items: FastApiOrderItem[];
  payments: Array<{ provider: string; method: string; status: FastApiPaymentStatus; amount: string }>;
}
