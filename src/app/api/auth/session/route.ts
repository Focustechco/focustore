import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, getAuthenticatedUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { cookies } from 'next/headers';
import { fastApiRequest, isPostgresSession } from '@/lib/auth/fastapi';

export async function GET() {
  try {
    return NextResponse.json({ user: await getAuthenticatedUser() });
  } catch (error) {
    console.error('Falha ao consultar sessão do cliente:', error);
    return NextResponse.json(
      { error: 'Não foi possível verificar sua sessão.' },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (sessionToken) {
      if (isPostgresSession(sessionToken)) {
        const backend = await fastApiRequest('/auth/logout', { method: 'POST' }, sessionToken);
        if (!backend.ok && backend.status !== 401) {
          return NextResponse.json({ error: 'Não foi possível encerrar sua sessão.' }, { status: 503 });
        }
      } else {
        await prisma.session.deleteMany({ where: { sessionToken } });
      }
    }

    const response = NextResponse.json({ user: null });
    response.cookies.set(AUTH_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch (error) {
    console.error('Falha ao encerrar sessão do cliente:', error);
    return NextResponse.json(
      { error: 'Não foi possível encerrar sua sessão.' },
      { status: 500 },
    );
  }
}
