import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import * as oidc from 'openid-client';
import { exportJWK, generateKeyPair, SignJWT, jwtVerify, importSPKI, exportPKCS8, exportSPKI } from 'jose';
import { appleClientSecret, safeReturnTo, socialOrigin, type Provider } from '../src/lib/auth/social/config';
import { flowCookie, openFlow, type SocialFlow } from '../src/lib/auth/social/flow';
import type { SocialDependencies } from '../src/lib/auth/social/http';

const origin = 'https://shop.example.test';
let db: PrismaClient;
let handlers: typeof import('../src/lib/auth/social/http');
let pair: Awaited<ReturnType<typeof generateKeyPair>>;
let wrongPair: Awaited<ReturnType<typeof generateKeyPair>>;
const configs = new Map<Provider, oidc.Configuration>();
type Scenario = { flow: SocialFlow; provider: Provider; sub: string; email?: string; emailVerified?: boolean | string;
  wrongSignature?: boolean; issuer?: string; audience?: string; nonce?: string; expired?: boolean; role?: string };
const codes = new Map<string, Scenario>();
let tokenRequests = 0;

before(async () => {
  const root = path.join(process.cwd(), '.local-validation');
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(path.join(root, 'social-'));
  const file = path.join(directory, 'store.db');
  await writeFile(file, '', { flag: 'wx' });
  const url = 'file:' + file.replace(/\\/g, '/');
  Object.assign(process.env, { DATABASE_URL: url, NODE_ENV: 'test', SOCIAL_LOGIN_ORIGIN: origin, SOCIAL_LOGIN_SECRET: randomUUID() });
  execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env: process.env, stdio: 'pipe' });
  db = new PrismaClient({ datasources: { db: { url } }, log: [] });
  handlers = await import('../src/lib/auth/social/http');
  pair = await generateKeyPair('RS256', { extractable: true });
  wrongPair = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(pair.publicKey), kid: 'test-signing-key', alg: 'RS256', use: 'sig' };
  for (const provider of ['google', 'apple'] as const) {
    const issuer = provider === 'google' ? 'https://accounts.google.com' : 'https://appleid.apple.com';
    const config = new oidc.Configuration({ issuer, authorization_endpoint: issuer + '/authorize', token_endpoint: issuer + '/token',
      jwks_uri: issuer + '/keys', id_token_signing_alg_values_supported: ['RS256'],
      ...(provider === 'google' ? { code_challenge_methods_supported: ['S256'] } : {}),
    }, `test-${provider}-client`, undefined, oidc.ClientSecretPost('synthetic-client-secret'));
    oidc.enableNonRepudiationChecks(config);
    config[oidc.customFetch] = async (input, init) => {
      const url = String(input);
      if (url.endsWith('/keys')) return Response.json({ keys: [jwk] });
      assert(url.endsWith('/token'));
      tokenRequests++;
      const body = new URLSearchParams(String(init?.body));
      const scenario = codes.get(body.get('code')!);
      assert(scenario && scenario.provider === provider);
      if (provider === 'google') assert.equal(body.get('code_verifier'), scenario.flow.verifier);
      else assert.equal(body.has('code_verifier'), false);
      const now = Math.floor(Date.now() / 1000);
      const jwt = await new SignJWT({ nonce: scenario.nonce ?? scenario.flow.nonce,
        ...(scenario.email === undefined ? {} : { email: scenario.email }),
        ...(scenario.emailVerified === undefined ? {} : { email_verified: scenario.emailVerified }),
        name: 'Synthetic Social User', role: scenario.role,
      }).setProtectedHeader({ alg: 'RS256', kid: 'test-signing-key' })
        .setIssuer(scenario.issuer ?? issuer).setAudience(scenario.audience ?? `test-${provider}-client`)
        .setSubject(scenario.sub).setIssuedAt(now - 10).setExpirationTime(scenario.expired ? now - 60 : now + 300)
        .sign(scenario.wrongSignature ? wrongPair.privateKey : pair.privateKey);
      return Response.json({ access_token: 'synthetic-access-token', token_type: 'Bearer', expires_in: 300, id_token: jwt });
    };
    configs.set(provider, config);
  }
});
after(async () => { await db?.$disconnect(); });
const dependencies: SocialDependencies = { get db() { return db; }, configuration: async provider => configs.get(provider)! };

async function begin(provider: Provider, input: Record<string, unknown> = {}, session?: string) {
  const response = await handlers.startSocial(new NextRequest(`${origin}/api/auth/social/${provider}/start`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin,
      'x-forwarded-for': randomUUID(), ...(session ? { cookie: `focus_session=${session}` } : {}) },
    body: JSON.stringify(input),
  }), provider, dependencies);
  const value = response.cookies.get(flowCookie(provider))?.value;
  const flow = value ? await openFlow(value, provider, origin) : undefined;
  return { response, flow, value };
}
async function complete(provider: Provider, options: Omit<Scenario, 'flow' | 'provider'>, input: Record<string, unknown> = {}, session?: string) {
  const started = await begin(provider, input, session);
  assert.equal(started.response.status, 200);
  const code = randomUUID();
  codes.set(code, { ...options, provider, flow: started.flow! });
  const parameters = new URLSearchParams({ code, state: started.flow!.state });
  const request = new NextRequest(`${origin}/api/auth/social/${provider}/callback${provider === 'google' ? '?' + parameters : ''}`, {
    method: provider === 'google' ? 'GET' : 'POST',
    headers: { cookie: `${flowCookie(provider)}=${started.value}`,
      ...(provider === 'apple' ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
    ...(provider === 'apple' ? { body: parameters.toString() } : {}),
  });
  return { response: await handlers.finishSocial(request, provider, dependencies), started, parameters };
}

test('Google creates a CUSTOMER, Account and compatible random session, with PKCE/state/nonce', async () => {
  const { response, started } = await complete('google', { sub: 'google-new', email: 'google@example.test', emailVerified: true, role: 'ADMIN' }, { returnTo: '/conta?tab=pedidos' });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), origin + '/conta?tab=pedidos');
  const authorization = new URL((await started.response.json()).url);
  assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(authorization.searchParams.get('nonce'), started.flow!.nonce);
  assert.equal(authorization.searchParams.get('state'), started.flow!.state);
  const user = await db.user.findUniqueOrThrow({ where: { email: 'google@example.test' } });
  assert.equal(user.role, 'CUSTOMER'); assert.equal(user.passwordHash, null);
  const account = await db.account.findUniqueOrThrow({ where: { provider_providerAccountId: { provider: 'google', providerAccountId: 'google-new' } } });
  assert.equal(account.userId, user.id); assert.equal(account.access_token, null); assert.equal(account.id_token, null);
  const token = response.cookies.get('focus_session')!.value;
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal((await db.session.findUniqueOrThrow({ where: { sessionToken: token } })).userId, user.id);
  assert.match(response.headers.get('set-cookie')!, /HttpOnly/i);
  assert.match(response.headers.get('set-cookie')!, /Secure/i);
});

test('Google linked identity uses provider/sub, does not replace email, password or role', async () => {
  const before = await db.user.findUniqueOrThrow({ where: { email: 'google@example.test' } });
  const result = await complete('google', { sub: 'google-new', email: 'different@example.test', emailVerified: false });
  assert.equal(result.response.status, 303);
  assert.deepEqual(await db.user.findUniqueOrThrow({ where: { id: before.id } }), before);
  assert.equal(await db.user.count({ where: { email: 'different@example.test' } }), 0);
});

test('Apple supports form_post/None Secure and private relay, then login without email', async () => {
  const first = await complete('apple', { sub: 'apple-stable-sub', email: 'private@privaterelay.appleid.com', emailVerified: 'true' });
  assert.equal(first.response.status, 303);
  assert.match(first.started.response.headers.get('set-cookie')!, /SameSite=none/i);
  assert.match(first.started.response.headers.get('set-cookie')!, /Secure/i);
  const auth = new URL((await first.started.response.json()).url);
  assert.equal(auth.searchParams.get('response_mode'), 'form_post');
  assert.equal(auth.searchParams.has('code_challenge'), false);
  const account = await db.account.findUniqueOrThrow({ where: { provider_providerAccountId: { provider: 'apple', providerAccountId: 'apple-stable-sub' } } });
  const second = await complete('apple', { sub: 'apple-stable-sub' });
  assert.equal(second.response.status, 303);
  assert.equal((await db.session.findUniqueOrThrow({ where: { sessionToken: second.response.cookies.get('focus_session')!.value } })).userId, account.userId);
  assert.equal(await db.account.count({ where: { provider: 'apple', providerAccountId: 'apple-stable-sub' } }), 1);
});

test('matching local admin email cannot link automatically or erase its password', async () => {
  const passwordHash = await bcrypt.hash('synthetic-local-password', 4);
  const user = await db.user.create({ data: { email: 'LocalAdmin@example.test', role: 'ADMIN', passwordHash } });
  const result = await complete('google', { sub: 'local-collision', email: 'localadmin@example.test', emailVerified: true });
  assert.equal(result.response.status, 409);
  assert.equal((await result.response.json()).code, 'account_link_required');
  const unchanged = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(unchanged.passwordHash, passwordHash); assert.equal(unchanged.role, 'ADMIN');
  assert.equal(await db.account.count({ where: { userId: user.id } }), 0);
  assert.equal(await db.session.count({ where: { userId: user.id } }), 0);
});

test('linking requires fresh local password plus valid session and preserves existing identity', async () => {
  const user = await db.user.findUniqueOrThrow({ where: { email: 'LocalAdmin@example.test' } });
  const session = await db.session.create({ data: { userId: user.id, sessionToken: randomUUID(), expires: new Date(Date.now() + 600000) } });
  assert.equal((await begin('google', { link: true, password: 'incorrect' }, session.sessionToken)).response.status, 403);
  assert.equal((await begin('google', { link: true, password: 'synthetic-local-password' })).response.status, 403);
  const result = await complete('google', { sub: 'local-collision', email: 'localadmin@example.test', emailVerified: true },
    { link: true, password: 'synthetic-local-password' }, session.sessionToken);
  assert.equal(result.response.status, 303);
  const account = await db.account.findUniqueOrThrow({ where: { provider_providerAccountId: { provider: 'google', providerAccountId: 'local-collision' } } });
  assert.equal(account.userId, user.id);
  const unchanged = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(unchanged.passwordHash, user.passwordHash); assert.equal(unchanged.role, 'ADMIN');
});

for (const invalid of ['wrongSignature', 'issuer', 'audience', 'nonce', 'expired'] as const) {
  test(`rejects invalid signed identity: ${invalid}`, async () => {
    const result = await complete('google', { sub: `invalid-${invalid}`, email: `${invalid}@example.test`, emailVerified: true,
      ...({ wrongSignature: { wrongSignature: true }, issuer: { issuer: 'https://evil.example' }, audience: { audience: 'another-client' },
        nonce: { nonce: 'different-nonce' }, expired: { expired: true } }[invalid]),
    });
    assert.equal(result.response.status, 400);
    assert.equal(await db.account.count({ where: { providerAccountId: `invalid-${invalid}` } }), 0);
    assert.equal(result.response.cookies.has('focus_session'), false);
  });
}

test('unverified email is rejected for a new account', async () => {
  assert.equal((await complete('google', { sub: 'unverified', email: 'unverified@example.test', emailVerified: false })).response.status, 403);
  assert.equal(await db.user.count({ where: { email: 'unverified@example.test' } }), 0);
});

test('cancellation, missing state, tampered flow and replay never create a second session', async () => {
  const started = await begin('google');
  const beforeRequests = tokenRequests;
  const cancelled = await handlers.finishSocial(new NextRequest(`${origin}/api/auth/social/google/callback?state=${started.flow!.state}&error=access_denied`, {
    headers: { cookie: `${flowCookie('google')}=${started.value}` },
  }), 'google', dependencies);
  assert.equal(cancelled.status, 400); assert.equal((await cancelled.json()).code, 'cancelled');
  assert.equal(tokenRequests, beforeRequests);
  assert.equal((await handlers.finishSocial(new NextRequest(`${origin}/api/auth/social/google/callback?code=x`), 'google', dependencies)).status, 400);
  const tampered = await handlers.finishSocial(new NextRequest(`${origin}/api/auth/social/google/callback?state=${started.flow!.state}&code=x`, {
    headers: { cookie: `${flowCookie('google')}=${started.value}x` },
  }), 'google', dependencies);
  assert.equal(tampered.status, 400);
  const success = await complete('google', { sub: 'replay', email: 'replay@example.test', emailVerified: true });
  assert.equal(success.response.status, 303);
  const replay = await handlers.finishSocial(new NextRequest(`${origin}/api/auth/social/google/callback?${success.parameters}`, {
    headers: { cookie: `${flowCookie('google')}=${success.started.value}` },
  }), 'google', dependencies);
  assert.equal(replay.status, 400);
  const user = await db.user.findUniqueOrThrow({ where: { email: 'replay@example.test' } });
  assert.equal(await db.session.count({ where: { userId: user.id } }), 1);
});

test('duplicate first logins cannot create duplicate users or provider bindings', async () => {
  const results = await Promise.all([1, 2].map(() => complete('google', { sub: 'concurrent', email: 'concurrent@example.test', emailVerified: true })));
  assert(results.some(result => result.response.status === 303));
  assert.equal(await db.user.count({ where: { email: 'concurrent@example.test' } }), 1);
  assert.equal(await db.account.count({ where: { provider: 'google', providerAccountId: 'concurrent' } }), 1);
});

test('redirects and origins are restricted; Apple needs HTTPS; secrets are not optional', async () => {
  for (const target of ['https://evil.example', '//evil.example', '/\\evil.example', '/api/auth/social/google/start']) {
    assert.equal(safeReturnTo(target, origin), '/');
  }
  const evil = await handlers.startSocial(new NextRequest(`${origin}/api/auth/social/google/start`, {
    method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}',
  }), 'google', dependencies);
  assert.equal(evil.status, 403);
  const secret = process.env.SOCIAL_LOGIN_SECRET;
  process.env.SOCIAL_LOGIN_SECRET = '';
  const fallback = process.env.NEXTAUTH_SECRET; process.env.NEXTAUTH_SECRET = '';
  try { assert.equal((await begin('google')).response.status, 503); }
  finally {
    process.env.SOCIAL_LOGIN_SECRET = secret;
    if (fallback === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = fallback;
  }
  const previousOrigin = process.env.SOCIAL_LOGIN_ORIGIN;
  process.env.SOCIAL_LOGIN_ORIGIN = 'http://localhost:3000';
  try {
    assert.equal((await handlers.startSocial(new NextRequest('http://localhost:3000/api/auth/social/apple/start'), 'apple', dependencies)).status, 503);
  } finally { process.env.SOCIAL_LOGIN_ORIGIN = previousOrigin; }
});

test('Apple client secret uses ES256, team issuer, Services ID audience binding and a short expiry', async () => {
  const ec = await generateKeyPair('ES256', { extractable: true });
  const secret = await appleClientSecret({ ...process.env, APPLE_CLIENT_ID: 'test.services.id', APPLE_TEAM_ID: 'TESTTEAM',
    APPLE_KEY_ID: 'TESTKEY', APPLE_PRIVATE_KEY: await exportPKCS8(ec.privateKey) });
  const publicKey = await importSPKI(await exportSPKI(ec.publicKey), 'ES256');
  const verified = await jwtVerify(secret, publicKey, { issuer: 'TESTTEAM', audience: 'https://appleid.apple.com', subject: 'test.services.id' });
  assert.equal(verified.protectedHeader.alg, 'ES256'); assert.equal(verified.protectedHeader.kid, 'TESTKEY');
  assert(verified.payload.exp! - verified.payload.iat! <= 300);
});
