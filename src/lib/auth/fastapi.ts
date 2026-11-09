import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { checkOrigin } from '@/lib/security/origin';

const COOKIE_NAME = 'focus_session';
const REQUEST_TIMEOUT_MS = 10_000;

export class FastApiConnectionError extends Error {
  constructor(
    public readonly code: 'timeout' | 'connection',
    public readonly correlationId: string,
    public readonly target: string,
    public readonly elapsedMs: number,
    public readonly errorName: string,
    public readonly causeCode: string,
  ) {
    super(code === 'timeout' ? 'FastAPI request timed out' : 'FastAPI connection failed');
    this.name = 'FastApiConnectionError';
  }
}

export class FastApiConfigurationError extends Error {
  public readonly code = 'configuration' as const;

  constructor(public readonly correlationId: string, message: string) {
    super(message);
    this.name = 'FastApiConfigurationError';
  }
}

export class FastApiOriginError extends Error {
  public readonly code = 'origin' as const;

  constructor(
    public readonly correlationId: string,
    public readonly receivedOrigin: string | null,
    public readonly requestOrigin: string | null,
    public readonly expectedOrigin: string | null,
  ) {
    super('Request origin rejected');
    this.name = 'FastApiOriginError';
  }
}

function errorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return 'none';
  const code = 'code' in error ? error.code : undefined;
  return typeof code === 'string' ? code : 'none';
}

function errorName(error: unknown): string {
  return error instanceof Error && error.name ? error.name : 'UnknownError';
}

function isTimeout(error: unknown): boolean {
  const names = new Set<string>();
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current; depth += 1) {
    if (current instanceof Error) names.add(current.name);
    const code = errorCode(current);
    if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'ABORT_ERR') return true;
    current = current instanceof Error ? current.cause : undefined;
  }
  return names.has('TimeoutError') || names.has('AbortError');
}

function diagnosticTarget(url: URL): string {
  return `${url.protocol}//${url.host}`;
}

function backendUrl(path: string): URL {
  const configured = process.env.FOCUS_FASTAPI_BASE_URL?.trim();
  const base = configured || (process.env.NODE_ENV !== 'production'
    ? `http://127.0.0.1:${process.env.FOCUS_BACKEND_PORT || '8000'}` : null);
  if (!base) throw new Error('FastAPI URL is not configured.');

  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    throw new Error('FastAPI URL is invalid.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('FastAPI URL is invalid.');
  }
  return new URL(`/api/v1${path}`, `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}/`);
}

export function isPostgresSession(token: string | undefined): boolean {
  return Boolean(token?.startsWith('pg_'));
}

export async function fastApiRequest(
  path: string,
  init: RequestInit = {},
  sessionToken?: string,
  correlationId = randomUUID(),
) {
  let url: URL;
  try {
    url = backendUrl(path);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[auth:${correlationId}] stage=next_bridge error_name=${errorName(error)} error_code=${errorCode(error)} failure=configuration`);
    }
    throw new FastApiConfigurationError(
      correlationId,
      error instanceof Error ? error.message : 'FastAPI URL is invalid',
    );
  }

  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  headers.set('origin', url.origin);
  headers.set('x-focus-correlation-id', correlationId);
  if (sessionToken) headers.set('cookie', `${COOKIE_NAME}=${sessionToken}`);
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[auth:${correlationId}] FastAPI request ${init.method ?? 'GET'} ${diagnosticTarget(url)}${url.pathname}`);
  }

  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      ...init,
      headers,
      cache: 'no-store',
      signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[auth:${correlationId}] FastAPI response HTTP ${response.status}`);
    }
    return response;
  } catch (error) {
    const code = isTimeout(error) ? 'timeout' : 'connection';
    const cause = error instanceof Error ? error.cause : undefined;
    const elapsedMs = Date.now() - startedAt;
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        `[auth:${correlationId}] stage=next_bridge target=${url.host} error_name=${errorName(error)} error_code=${errorCode(error)} cause_code=${errorCode(cause)} failure=${code} elapsed_ms=${elapsedMs}`,
      );
    }
    throw new FastApiConnectionError(code, correlationId, url.host, elapsedMs, errorName(error), errorCode(cause));
  }
}

export async function fastApiRequestFromNextRequest(
  request: Request,
  path: string,
  init: RequestInit = {},
  correlationId = randomUUID(),
) {
  const originCheck = checkOrigin(request);
  if (!originCheck.allowed) {
    throw new FastApiOriginError(
      correlationId,
      originCheck.receivedOrigin,
      originCheck.requestOrigin,
      originCheck.expectedOrigin,
    );
  }
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return fastApiRequest(path, init, token, correlationId);
}

export function copySetCookie(source: Response, target: Response): void {
  const sourceHeaders = source.headers as Headers & { getSetCookie?: () => string[] };
  const getSetCookie = sourceHeaders.getSetCookie;
  const values = typeof getSetCookie === 'function' ? getSetCookie.call(sourceHeaders) : [];
  if (values.length) {
    values.forEach((value) => target.headers.append('set-cookie', value));
    return;
  }
  const value = source.headers.get('set-cookie');
  if (value) target.headers.set('set-cookie', value);
}

export async function postgresSessionUser(token: string) {
  const response = await fastApiRequest('/users/me', {}, token);
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('PostgreSQL session unavailable.');
  return response.json() as Promise<{ id: string; name: string | null; email: string; role: string }>;
}
