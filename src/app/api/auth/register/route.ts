import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  copySetCookie,
  FastApiConfigurationError,
  FastApiConnectionError,
  FastApiOriginError,
  fastApiRequestFromNextRequest,
} from '@/lib/auth/fastapi';

const registrationSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(100),
  email: z.string().trim().email('Informe um e-mail válido.').max(254),
  cpf: z.string().optional(),
  password: z.string().min(12, 'A senha deve ter ao menos 12 caracteres.').max(128),
});

function diagnosticHeaders(correlationId: string, source?: string): Headers {
  const headers = new Headers({ 'x-focus-correlation-id': correlationId });
  if (source) headers.set('x-focus-failure-source', source);
  return headers;
}

function bridgeFailure(error: unknown): {
  code: string;
  type: string;
  target?: string;
  elapsedMs?: number;
  receivedOrigin?: string | null;
  requestOrigin?: string | null;
  expectedOrigin?: string | null;
} {
  if (error instanceof FastApiConnectionError) {
    return {
      code: error.code,
      type: `${error.errorName}/${error.causeCode}`,
      target: error.target,
      elapsedMs: error.elapsedMs,
    };
  }
  if (error instanceof FastApiConfigurationError) return { code: 'configuration', type: error.name };
  if (error instanceof FastApiOriginError) {
    return {
      code: 'origin',
      type: error.name,
      receivedOrigin: error.receivedOrigin,
      requestOrigin: error.requestOrigin,
      expectedOrigin: error.expectedOrigin,
    };
  }
  return { code: 'internal', type: error instanceof Error ? error.name : 'UnknownError' };
}

function safeBackendDetail(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'no-detail';
  const detail = 'detail' in payload ? payload.detail : undefined;
  if (typeof detail !== 'string') return 'no-detail';
  return detail.replace(/(password|token|cookie|authorization)\s*[:=]\s*[^\s;]+/gi, '$1=[redacted]').slice(0, 200);
}

function safeErrorMessage(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error);
  return value
    .replace(/(password|token|cookie|authorization)\s*[:=]\s*[^\s;]+/gi, '$1=[redacted]')
    .replace(/(https?:\/\/)([^/\s@]+):([^@\s]+)@/gi, '$1[redacted]@')
    .slice(0, 240);
}

function errorLogDetails(error: unknown): string {
  const current = error instanceof Error ? error : undefined;
  const cause = current?.cause instanceof Error ? current.cause : undefined;
  const stack = current?.stack ?? '';
  const firstFrame = stack.split('\n').find((line) => line.trim().startsWith('at '))?.trim() ?? 'none';
  const location = firstFrame.match(/(?:\(|\s)([^()\s]+):(\d+):(\d+)\)?$/);
  const functionMatch = firstFrame.match(/^at\s+(.+?)\s+\(/);
  return [
    `error_name=${current?.name ?? 'UnknownError'}`,
    `message=${safeErrorMessage(error)}`,
    `cause_name=${cause?.name ?? 'none'}`,
    `cause_code=${cause && 'code' in cause && typeof cause.code === 'string' ? cause.code : 'none'}`,
    `file=${location?.[1] ?? 'unknown'}`,
    `line=${location?.[2] ?? 'unknown'}`,
    `column=${location?.[3] ?? 'unknown'}`,
    `function=${functionMatch?.[1] ?? 'unknown'}`,
    `stack=${safeErrorMessage(firstFrame)}`,
  ].join(' ');
}

export async function POST(request: Request) {
  const correlationId = randomUUID();
  let stage = 'request_validation';
  if (process.env.NODE_ENV !== 'production') console.info(`[auth:${correlationId}] register received`);

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400, headers: diagnosticHeaders(correlationId, 'next_validation') });
  }

  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Confira os dados informados.' },
      { status: 400, headers: diagnosticHeaders(correlationId, 'next_validation') },
    );
  }
  if (parsed.data.cpf?.trim()) {
    return NextResponse.json(
      { error: 'CPF ainda não está disponível no cadastro.' },
      { status: 400, headers: diagnosticHeaders(correlationId, 'next_validation') },
    );
  }

  try {
    stage = 'fastapi_request';
    const backend = await fastApiRequestFromNextRequest(request, '/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: parsed.data.name, email: parsed.data.email, password: parsed.data.password }),
    }, correlationId);
    stage = 'fastapi_response';
    const payload = await backend.json().catch(() => ({}));
    if (!backend.ok && process.env.NODE_ENV !== 'production') {
      console.error(`[auth:${correlationId}] FastAPI response HTTP ${backend.status} detail=${safeBackendDetail(payload)}`);
    }
    const response = NextResponse.json(
      backend.ok
        ? { user: payload }
        : { error: backend.status === 409 ? 'Não foi possível concluir o cadastro. Tente novamente.' : 'Não foi possível criar sua conta.' },
      { status: backend.status, headers: diagnosticHeaders(correlationId, backend.ok ? undefined : 'fastapi_response') },
    );
    if (!backend.ok) {
      response.headers.set('x-focus-error-type', 'fastapi_http');
      response.headers.set('x-focus-failure-stage', 'fastapi_response');
    }
    stage = 'copy_session_cookie';
    copySetCookie(backend, response);
    return response;
  } catch (error) {
    const failure = bridgeFailure(error);
    if (process.env.NODE_ENV !== 'production') {
      const target = failure.target ? ` target=${failure.target}` : '';
      const elapsed = failure.elapsedMs === undefined ? '' : ` elapsed_ms=${failure.elapsedMs}`;
      console.error(`[auth:${correlationId}] stage=${failure.code === 'origin' ? 'next_origin' : stage} failure=${failure.code} error_type=${failure.type}${target}${elapsed} ${errorLogDetails(error)}`);
    }
    const isOriginFailure = failure.code === 'origin';
    const headers = diagnosticHeaders(correlationId, isOriginFailure ? 'next_origin' : 'next_bridge');
    headers.set('x-focus-error-type', failure.type);
    headers.set('x-focus-failure-stage', isOriginFailure ? 'next_origin' : stage);
    headers.set('x-focus-error-code', failure.code);
    if (failure.target) headers.set('x-focus-target', failure.target);
    if (failure.receivedOrigin) headers.set('x-focus-received-origin', failure.receivedOrigin);
    if (failure.requestOrigin) headers.set('x-focus-request-origin', failure.requestOrigin);
    if (failure.expectedOrigin) headers.set('x-focus-expected-origin', failure.expectedOrigin);
    return NextResponse.json(
      { error: 'Não foi possível concluir o cadastro. Tente novamente.' },
      { status: isOriginFailure ? 403 : 503, headers },
    );
  }
}
