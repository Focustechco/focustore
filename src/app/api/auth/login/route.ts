import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AUTH_COOKIE_NAME } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Informe seu e-mail ou CPF.').max(254),
  password: z.string().min(1, 'Informe sua senha.').max(72),
  remember: z.boolean().optional().default(false),
});

function formatCpf(digits: string) {
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Confira os dados informados.' },
      { status: 400 },
    );
  }

  const { identifier, password, remember } = parsed.data;
  const normalizedIdentifier = identifier.toLowerCase();

  try {
    const user = normalizedIdentifier.includes('@')
      ? await prisma.user.findUnique({
          where: { email: normalizedIdentifier },
          select: { id: true, name: true, email: true, passwordHash: true },
        })
      : await prisma.user.findFirst({
          where: {
            cpf: {
              in: [identifier.replace(/\D/g, ''), formatCpf(identifier.replace(/\D/g, ''))],
            },
          },
          select: { id: true, name: true, email: true, passwordHash: true },
        });

    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json(
        { error: 'E-mail/CPF ou senha inválidos.' },
        { status: 401 },
      );
    }

    const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24;
    const sessionToken = randomBytes(32).toString('hex');
    await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires: new Date(Date.now() + maxAge * 1000),
      },
    });

    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
    });
    response.cookies.set(AUTH_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });
    return response;
  } catch (error) {
    console.error('Falha ao autenticar cliente:', error);
    return NextResponse.json(
      { error: 'Não foi possível entrar. Tente novamente.' },
      { status: 500 },
    );
  }
}
