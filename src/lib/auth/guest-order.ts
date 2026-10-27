import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const localSecret = randomBytes(32);
const lifetime = 2 * 60 * 60;
function secret() {
  const configured = process.env.NEXTAUTH_SECRET;
  if (configured && Buffer.byteLength(configured) >= 32) return configured;
  if (process.env.NODE_ENV === 'production') throw new Error('Configure segredo de sessão com pelo menos 32 bytes.');
  return localSecret;
}

export function grantGuestOrder(orderId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ id: orderId, expires: Math.floor(now / 1000) + lifetime })).toString('base64url');
  return `${payload}.${createHmac('sha256', secret()).update(payload).digest('base64url')}`;
}

export function canReadGuestOrder(token: string | undefined, orderId: string, now = Date.now()): boolean {
  if (!token || token.length > 1024) return false;
  try {
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return false;
    const expected = createHmac('sha256', secret()).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parsed.id === orderId && Number.isSafeInteger(parsed.expires) && parsed.expires > now / 1000;
  } catch {
    return false;
  }
}
