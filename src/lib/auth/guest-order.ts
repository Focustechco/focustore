import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_LIFETIME_MS = 60 * 60 * 1000;

function secret(): string {
  const value = process.env.NEXTAUTH_SECRET || process.env.SOCIAL_LOGIN_SECRET;
  if (!value) throw new Error('Guest order signing secret is not configured.');
  return value;
}

function signature(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

export function grantGuestOrder(orderId: string, now = Date.now()): string {
  const payload = `${orderId}.${now + TOKEN_LIFETIME_MS}`;
  return `${payload}.${signature(payload)}`;
}

export function canReadGuestOrder(token: unknown, orderId: string, now = Date.now()): boolean {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== orderId) return false;
  const expiry = Number(parts[1]);
  if (!Number.isSafeInteger(expiry) || now > expiry) return false;
  try {
    const expected = Buffer.from(signature(`${parts[0]}.${parts[1]}`));
    const actual = Buffer.from(parts[2]);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
