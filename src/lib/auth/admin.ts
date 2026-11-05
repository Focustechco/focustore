import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { isPostgresSession } from '@/lib/auth/fastapi';
import { getAuthenticatedUser } from '@/lib/auth/session';

type AdminAuthorization =
  | { authorized: true; role: 'ADMIN' | 'MANAGER' }
  | { authorized: false; response: NextResponse };

export async function requireAdmin() {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  const origin = requestHeaders.get('origin');
  const forwardedProtocol = requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const host = requestHeaders.get('host');
  const expectedOrigins = new Set<string>();
  if (host) expectedOrigins.add(`${forwardedProtocol || 'http'}://${host}`);
  if (process.env.NEXT_PUBLIC_APP_URL) {
    expectedOrigins.add(process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ''));
  }
  if (requestHeaders.get('sec-fetch-site') === 'cross-site' || (origin && !expectedOrigins.has(origin))) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Origem da requisição não autorizada.' }, { status: 403 }),
    } satisfies AdminAuthorization;
  }

  if (!sessionToken) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 }),
    } satisfies AdminAuthorization;
  }

  if (isPostgresSession(sessionToken)) {
    const customer = await getAuthenticatedUser();
    return {
      authorized: false,
      response: NextResponse.json(
        { error: customer ? 'Acesso nÃ£o autorizado.' : 'AutenticaÃ§Ã£o necessÃ¡ria.' },
        { status: customer ? 403 : 401 },
      ),
    } satisfies AdminAuthorization;
  }

  const session = await prisma.session.findUnique({
    where: { sessionToken },
    select: {
      expires: true,
      user: { select: { role: true } },
    },
  });

  if (!session || session.expires <= new Date()) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 }),
    } satisfies AdminAuthorization;
  }

  if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 }),
    } satisfies AdminAuthorization;
  }

  return {
    authorized: true,
    role: session.user.role,
  } satisfies AdminAuthorization;
}
