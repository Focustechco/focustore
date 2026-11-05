import { cookies } from 'next/headers';
import { sameOrigin } from '@/lib/security/origin';

const COOKIE_NAME = 'focus_session';

function backendUrl(path: string): URL {
  const configured = process.env.FOCUS_FASTAPI_BASE_URL?.trim();
  const base = configured || (process.env.NODE_ENV !== 'production'
    ? `http://127.0.0.1:${process.env.FOCUS_BACKEND_PORT || '8000'}` : null);
  if (!base) throw new Error('API FastAPI nÃ£o configurada.');
  let parsed: URL;
  try { parsed = new URL(base); } catch { throw new Error('API FastAPI invÃ¡lida.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('API FastAPI invÃ¡lida.');
  }
  return new URL(`/api/v1${path}`, `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}/`);
}

export function isPostgresSession(token: string | undefined): boolean {
  return Boolean(token?.startsWith('pg_'));
}

export async function fastApiRequest(path: string, init: RequestInit = {}, sessionToken?: string) {
  const url = backendUrl(path);
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  headers.set('origin', url.origin);
  if (sessionToken) headers.set('cookie', `${COOKIE_NAME}=${sessionToken}`);
  return fetch(url, { ...init, headers, cache: 'no-store' });
}

export async function fastApiRequestFromNextRequest(request: Request, path: string, init: RequestInit = {}) {
  if (!sameOrigin(request)) throw new Error('Origem da requisiÃ§Ã£o nÃ£o autorizada.');
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return fastApiRequest(path, init, token);
}

export function copySetCookie(source: Response, target: Response): void {
  const getSetCookie = (source.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const values = getSetCookie?.call(source) ?? [];
  if (values.length) { values.forEach((value) => target.headers.append('set-cookie', value)); return; }
  const value = source.headers.get('set-cookie');
  if (value) target.headers.set('set-cookie', value);
}

export async function postgresSessionUser(token: string) {
  const response = await fastApiRequest('/users/me', {}, token);
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('SessÃ£o PostgreSQL indisponÃ­vel.');
  return response.json() as Promise<{ id: string; name: string | null; email: string; role: string }>;
}
