import * as oidc from 'openid-client';
import { importPKCS8, SignJWT } from 'jose';

export type Provider = 'google' | 'apple';
export class SocialLoginError extends Error {
  constructor(public readonly code: string, public readonly status = 400) { super(code); }
}

export function providerName(value: string): Provider {
  if (value !== 'google' && value !== 'apple') throw new SocialLoginError('provider_invalid', 404);
  return value;
}

export function socialOrigin(env = process.env): string {
  const value = env.SOCIAL_LOGIN_ORIGIN;
  if (!value) throw new SocialLoginError('not_configured', 503);
  let url: URL;
  try { url = new URL(value); } catch { throw new SocialLoginError('not_configured', 503); }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      (url.protocol !== 'https:' && !(env.NODE_ENV !== 'production' && url.protocol === 'http:' &&
       ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw new SocialLoginError('not_configured', 503);
  }
  return url.origin;
}

export function socialSecret(env = process.env): string {
  const value = env.SOCIAL_LOGIN_SECRET || env.NEXTAUTH_SECRET;
  if (!value || Buffer.byteLength(value) < 32) throw new SocialLoginError('not_configured', 503);
  return value;
}

export function callbackUrl(provider: Provider, origin: string): string {
  return `${origin}/api/auth/social/${provider}/callback`;
}

export function safeReturnTo(value: unknown, origin: string): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') ||
      value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value) || value.length > 2000) return '/';
  const parsed = new URL(value, origin);
  if (parsed.origin !== origin || parsed.pathname.startsWith('/api/')) return '/';
  return parsed.pathname + parsed.search + parsed.hash;
}

export async function appleClientSecret(env = process.env): Promise<string> {
  if (!env.APPLE_CLIENT_ID || !env.APPLE_TEAM_ID || !env.APPLE_KEY_ID || !env.APPLE_PRIVATE_KEY) {
    throw new SocialLoginError('not_configured', 503);
  }
  try {
    const key = await importPKCS8(env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'), 'ES256');
    return await new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: env.APPLE_KEY_ID })
      .setIssuer(env.APPLE_TEAM_ID).setSubject(env.APPLE_CLIENT_ID)
      .setAudience('https://appleid.apple.com').setIssuedAt().setExpirationTime('5m').sign(key);
  } catch { throw new SocialLoginError('not_configured', 503); }
}

const cache = new Map<Provider, { expires: number; configuration: oidc.Configuration }>();
export async function providerConfiguration(provider: Provider): Promise<oidc.Configuration> {
  const existing = cache.get(provider);
  if (existing && existing.expires > Date.now()) return existing.configuration;
  const clientId = provider === 'google' ? process.env.GOOGLE_CLIENT_ID : process.env.APPLE_CLIENT_ID;
  const secret = provider === 'google' ? process.env.GOOGLE_CLIENT_SECRET : await appleClientSecret();
  if (!clientId || !secret) throw new SocialLoginError('not_configured', 503);
  const issuer = provider === 'google' ? 'https://accounts.google.com' : 'https://appleid.apple.com';
  const configuration = await oidc.discovery(new URL(issuer), clientId,
    { id_token_signed_response_alg: 'RS256' }, oidc.ClientSecretPost(secret),
    { timeout: 5, execute: [oidc.enableNonRepudiationChecks] });
  cache.set(provider, { expires: Date.now() + 4 * 60 * 1000, configuration });
  return configuration;
}
