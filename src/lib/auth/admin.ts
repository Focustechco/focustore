import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { redirect } from 'next/navigation';

type AdminAuthorization =
  | { authorized: true; role: 'ADMIN' | 'MANAGER' }
  | { authorized: false; response: NextResponse };

export async function requireAdmin() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get('origin');
  if (requestHeaders.get('sec-fetch-site') === 'cross-site' ||
      (origin && (!URL.canParse(origin) || new URL(origin).host !== requestHeaders.get('host')))) {
    return { authorized: false, response: NextResponse.json({ error: 'Origem inválida.' }, { status: 403 }) } satisfies AdminAuthorization;
  }
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 }),
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

export async function requireAdminPage() {
  const authorization = await requireAdmin();
  if (!authorization.authorized) redirect('/login');
  return authorization;
}
