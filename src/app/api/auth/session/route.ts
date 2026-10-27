import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, getAuthenticatedUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { cookies } from 'next/headers';
import { sameOrigin } from '@/lib/security/origin';

export async function GET() {
  try {
    return NextResponse.json({ user: await getAuthenticatedUser() });
  } catch (error) {
    console.error('Falha ao consultar sessão do cliente:');
    return NextResponse.json(
      { error: 'Não foi possível verificar sua sessão.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (sessionToken) {
      await prisma.session.deleteMany({ where: { sessionToken } });
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
    console.error('Falha ao encerrar sessão do cliente:');
    return NextResponse.json(
      { error: 'Não foi possível encerrar sua sessão.' },
      { status: 500 },
    );
  }
}
