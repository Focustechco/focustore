import type { FastApiOrder, FastApiShippingOption, PublicUuid } from '@/lib/api/contracts';

/** Contract only: implementation must remain behind an approved cutover flag. */
export interface FastApiCheckoutInput {
  items: Array<{ variantId: PublicUuid; quantity: number }>;
  shippingAddress: {
    street: string;
    number: string;
    complement?: string | null;
    neighborhood: string;
    city: string;
    state: string;
    postalCode: string;
  };
  shippingOption: { carrier: FastApiShippingOption['carrier']; serviceName: string };
  paymentMethod: 'PIX' | 'CREDIT_CARD';
  idempotencyKey: string;
}

export interface FastApiCheckoutAdapter {
  createOrder(input: FastApiCheckoutInput): Promise<FastApiOrder>;
  cancelOrder(orderId: PublicUuid): Promise<FastApiOrder>;
}

export const FASTAPI_CHECKOUT_DEFAULT_ENABLED = false;
