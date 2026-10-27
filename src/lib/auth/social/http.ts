import { NextRequest, NextResponse } from 'next/server';
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as oidc from 'openid-client';
import { AUTH_COOKIE_NAME } from '../session';
import { sameOrigin } from '@/lib/security/origin';
import { rateLimit } from '@/lib/security/rate-limit';
import { callbackUrl, safeReturnTo, socialOrigin, socialSecret, SocialLoginError, type Provider } from './config';
import { digest, FLOW_LIFETIME, flowCookie, flowIdentifier, openFlow, sealFlow, type SocialFlow } from './flow';
import { persistIdentity } from './persistence';

export type SocialDependencies = {
  db: PrismaClient;
  configuration: (provider: Provider) => Promise<oidc.Configuration>;
};
const messages: Record<string, string> = {
  not_configured: 'Login social ainda não configurado. Use e-mail e senha.',
  account_link_required: 'Esta conta já existe. Entre com sua senha antes de vincular o provedor.',
  link_denied: 'Entre novamente e confirme sua senha para vincular a conta.',
  account_in_use: 'Esta identidade já está vinculada a outra conta.',
  verified_email_required: 'O provedor não informou um e-mail verificado para criar a conta.',
  cancelled: 'Autenticação cancelada. Volte à loja para tentar novamente.',
};
function secureResponse(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}
function failure(error: unknown) {
  const known = error instanceof SocialLoginError;
  return secureResponse(NextResponse.json({
    error: known ? messages[error.code] || 'Não foi possível autenticar. Volte à loja e tente novamente.' : 'Não foi possível autenticar. Volte à loja e tente novamente.',
    code: known ? error.code : 'authentication_failed',
  }, { status: known ? error.status : 400 }));
}
async function limitedBody(request: Request, limit = 16384): Promise<string> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.length;
      if (size > limit) { await reader.cancel(); throw new SocialLoginError('request_invalid', 413); }
      chunks.push(result.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString('utf8');
}
function cookieOptions(provider: Provider, origin: string) {
  return { httpOnly: true, secure: origin.startsWith('https:'), sameSite: provider === 'apple' ? 'none' as const : 'lax' as const,
    path: `/api/auth/social/${provider}`, maxAge: FLOW_LIFETIME };
}

export async function startSocial(request: NextRequest, provider: Provider, dependencies: SocialDependencies) {
  try {
    const origin = socialOrigin();
    socialSecret();
    if (request.nextUrl.origin !== origin || !sameOrigin(request)) throw new SocialLoginError('origin_invalid', 403);
    if (provider === 'apple' && !origin.startsWith('https:')) throw new SocialLoginError('not_configured', 503);
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 100) || 'unknown';
    if (!rateLimit(`social:${ip}`, 20, 60000).success) throw new SocialLoginError('rate_limited', 429);
    let input: { returnTo?: unknown; link?: unknown; password?: unknown } = { returnTo: request.nextUrl.searchParams.get('returnTo') };
    if (request.method === 'POST') {
      if (!request.headers.get('content-type')?.startsWith('application/json')) throw new SocialLoginError('request_invalid');
      const parsed: unknown = JSON.parse(await limitedBody(request, 4096));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new SocialLoginError('request_invalid');
      input = parsed;
    }
    const flow: SocialFlow = { provider, state: oidc.randomState(), nonce: oidc.randomNonce(),
      verifier: oidc.randomPKCECodeVerifier(), proof: oidc.randomState(), returnTo: safeReturnTo(input.returnTo, origin) };
    if (input.link === true) {
      const sessionToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
      const session = sessionToken ? await dependencies.db.session.findUnique({ where: { sessionToken }, include: { user: true } }) : null;
      if (!session || session.expires <= new Date() || !session.user.passwordHash || typeof input.password !== 'string' ||
          Buffer.byteLength(input.password) > 72 || !(await bcrypt.compare(input.password, session.user.passwordHash))) {
        throw new SocialLoginError('link_denied', 403);
      }
      flow.linkUserId = session.userId;
      flow.linkSession = session.sessionToken;
    }
    const configuration = await dependencies.configuration(provider);
    const parameters: Record<string, string> = { redirect_uri: callbackUrl(provider, origin), scope: provider === 'google' ? 'openid email profile' : 'openid email',
      response_type: 'code', state: flow.state, nonce: flow.nonce };
    if (provider === 'google' || configuration.serverMetadata().supportsPKCE()) {
      parameters.code_challenge = await oidc.calculatePKCECodeChallenge(flow.verifier);
      parameters.code_challenge_method = 'S256';
    }
    if (provider === 'apple') parameters.response_mode = 'form_post';
    const authorization = oidc.buildAuthorizationUrl(configuration, parameters);
    const encrypted = await sealFlow(flow, origin);
    await dependencies.db.verificationToken.create({ data: { identifier: flowIdentifier(provider, flow.state),
      token: digest(flow.proof), expires: new Date(Date.now() + FLOW_LIFETIME * 1000) } });
    const response = request.method === 'POST' ? NextResponse.json({ url: authorization.href }) : NextResponse.redirect(authorization, 303);
    response.cookies.set(flowCookie(provider), encrypted, cookieOptions(provider, origin));
    return secureResponse(response);
  } catch (error) { return failure(error); }
}

export async function finishSocial(request: NextRequest, provider: Provider, dependencies: SocialDependencies) {
  let origin: string | undefined;
  try {
    origin = socialOrigin();
    if (request.nextUrl.origin !== origin) throw new SocialLoginError('origin_invalid', 403);
    if ((provider === 'google' && request.method !== 'GET') || (provider === 'apple' && request.method !== 'POST')) {
      throw new SocialLoginError('callback_invalid');
    }
    const value = request.cookies.get(flowCookie(provider))?.value;
    if (!value) throw new SocialLoginError('callback_invalid');
    const flow = await openFlow(value, provider, origin);
    let parameters: URLSearchParams;
    let grantInput: URL | Request;
    if (request.method === 'POST') {
      if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) throw new SocialLoginError('callback_invalid');
      const body = await limitedBody(request);
      parameters = new URLSearchParams(body);
      grantInput = new Request(callbackUrl(provider, origin), { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
    } else {
      if (request.url.length > 16384) throw new SocialLoginError('callback_invalid');
      parameters = request.nextUrl.searchParams;
      grantInput = new URL(request.url);
    }
    if (parameters.getAll('state').length !== 1 || parameters.get('state') !== flow.state) throw new SocialLoginError('callback_invalid');
    const consumed = await dependencies.db.verificationToken.deleteMany({ where: {
      identifier: flowIdentifier(provider, flow.state), token: digest(flow.proof), expires: { gt: new Date() },
    } });
    if (consumed.count !== 1) throw new SocialLoginError('callback_invalid');
    if (parameters.has('error')) throw new SocialLoginError(parameters.get('error') === 'access_denied' ? 'cancelled' : 'callback_invalid');
    const configuration = await dependencies.configuration(provider);
    const tokens = await oidc.authorizationCodeGrant(configuration, grantInput, {
      expectedState: flow.state, expectedNonce: flow.nonce, idTokenExpected: true,
      pkceCodeVerifier: provider === 'google' || configuration.serverMetadata().supportsPKCE() ? flow.verifier : undefined,
    });
    const claims = tokens.claims();
    if (!claims || typeof claims.sub !== 'string') throw new SocialLoginError('identity_invalid');
    const result = await persistIdentity(dependencies.db, provider, {
      sub: claims.sub, email: typeof claims.email === 'string' ? claims.email : undefined,
      emailVerified: claims.email_verified === true || (provider === 'apple' && claims.email_verified === 'true'),
      name: typeof claims.name === 'string' ? claims.name : undefined,
    }, flow);
    const response = NextResponse.redirect(new URL(safeReturnTo(flow.returnTo, origin), origin), 303);
    response.cookies.set(AUTH_COOKIE_NAME, result.sessionToken, { httpOnly: true, secure: origin.startsWith('https:'),
      sameSite: 'lax', path: '/', maxAge: result.maxAge });
    response.cookies.set(flowCookie(provider), '', { ...cookieOptions(provider, origin), maxAge: 0 });
    return secureResponse(response);
  } catch (error) {
    const response = failure(error);
    if (origin) response.cookies.set(flowCookie(provider), '', { ...cookieOptions(provider, origin), maxAge: 0 });
    return response;
  }
}
