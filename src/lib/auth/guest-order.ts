import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_LIFETIME_MS = 2 * 60 * 60 * 1000;

export const GUEST_ORDER_MAX_AGE_SECONDS = TOKEN_LIFETIME_MS / 1000;

export function guestOrderCookieName(orderId: string): string {
  return `focus_guest_order_${orderId}`;
}

export function guestPaymentCookieName(orderId: string): string {
  return `focus_guest_payment_${orderId}`;
}

export function assertGuestOrderSecret(): void {
  guestOrderSecret();
}

function guestOrderSecret(): string {
  const secret = process.env.GUEST_ORDER_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('Configure GUEST_ORDER_SECRET ou NEXTAUTH_SECRET para proteger pedidos de visitantes.');
  }
  return secret;
}

function signature(payload: string): Buffer {
  return createHmac('sha256', guestOrderSecret()).update(payload).digest();
}

export function grantGuestOrder(orderId: string, now = Date.now()): string {
  if (!orderId || !Number.isFinite(now)) {
    throw new Error('Pedido ou horário inválido para gerar acesso de visitante.');
  }

  const payload = Buffer.from(
    JSON.stringify({ orderId, expiresAt: now + TOKEN_LIFETIME_MS }),
  ).toString('base64url');
  return `${payload}.${signature(payload).toString('base64url')}`;
}

export function canReadGuestOrder(
  token: string | null | undefined,
  orderId: string,
  now = Date.now(),
): boolean {
  if (!token || !orderId || !Number.isFinite(now)) return false;

  try {
    const [payload, encodedSignature, extra] = token.split('.');
    if (!payload || !encodedSignature || extra !== undefined) return false;

    const actualSignature = Buffer.from(encodedSignature, 'base64url');
    const expectedSignature = signature(payload);
    if (
      actualSignature.length !== expectedSignature.length ||
      !timingSafeEqual(actualSignature, expectedSignature)
    ) {
      return false;
    }

    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      typeof claims !== 'object' ||
      claims === null ||
      !('orderId' in claims) ||
      !('expiresAt' in claims) ||
      claims.orderId !== orderId ||
      typeof claims.expiresAt !== 'number'
    ) {
      return false;
    }

    return now < claims.expiresAt;
  } catch {
    return false;
  }
}
