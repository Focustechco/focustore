import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME } from '@/lib/auth/session';
import { fastApiRequest, isPostgresSession } from '@/lib/auth/fastapi';

export type PostgresOrder = {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  subtotal: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  items: {
    id: string;
    productId: string | null;
    variantId: string;
    productName: string;
    variantName: string;
    sku: string;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
    imageUrl: string | null;
  }[];
};

function mapOrder(value: any): PostgresOrder {
  return {
    id: value.id,
    orderNumber: value.order_number,
    status: value.status,
    currency: value.currency || 'BRL',
    subtotal: Number(value.subtotal),
    total: Number(value.total),
    createdAt: value.created_at,
    updatedAt: value.updated_at,
    items: (value.items || []).map((item: any) => ({
      id: item.id,
      productId: item.product_id ?? null,
      variantId: item.variant_id,
      productName: item.product_name,
      variantName: item.variant_name,
      sku: item.sku,
      unitPrice: Number(item.unit_price),
      quantity: item.quantity,
      totalPrice: Number(item.total_price),
      imageUrl: item.image_url ?? null,
    })),
  };
}

async function sessionToken() {
  return (await cookies()).get(AUTH_COOKIE_NAME)?.value;
}

export async function getPostgresOrders(): Promise<PostgresOrder[]> {
  const token = await sessionToken();
  if (!isPostgresSession(token)) return [];
  const response = await fastApiRequest('/orders', {}, token);
  if (!response.ok) throw new Error('Não foi possível consultar seus pedidos.');
  const payload = await response.json();
  return (payload.items || []).map(mapOrder);
}

export async function getPostgresOrder(orderId: string): Promise<PostgresOrder | null> {
  const token = await sessionToken();
  if (!isPostgresSession(token)) return null;
  const response = await fastApiRequest(`/orders/${encodeURIComponent(orderId)}`, {}, token);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Não foi possível consultar o pedido.');
  return mapOrder(await response.json());
}
