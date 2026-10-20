import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { AUTH_COOKIE_NAME } from '@/lib/auth/session';

const registrationSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(100),
  email: z.string().trim().email('Informe um e-mail válido.').max(254),
  cpf: z.string().optional(),
  password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.').max(72),
});

function isValidCpf(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;

  const digit = (length: number) => {
    const sum = cpf
      .slice(0, length)
      .split('')
      .reduce((total, value, index) => total + Number(value) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }

  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Confira os dados informados.' },
      { status: 400 },
    );
  }

  const { name, password } = parsed.data;
  const email = parsed.data.email.toLowerCase();
  const cpf = parsed.data.cpf?.replace(/\D/g, '') || null;

  if (cpf && !isValidCpf(cpf)) {
    return NextResponse.json({ error: 'Informe um CPF válido.' }, { status: 400 });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const maxAge = 60 * 60 * 24 * 30;
    const sessionToken = randomBytes(32).toString('hex');
    const user = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: { name, email, cpf, passwordHash },
        select: { id: true, name: true, email: true },
      });

      await transaction.session.create({
        data: {
          sessionToken,
          userId: createdUser.id,
          expires: new Date(Date.now() + maxAge * 1000),
        },
      });

      return createdUser;
    });

    const response = NextResponse.json({ user });
    response.cookies.set(AUTH_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });
    return response;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Já existe uma conta com este e-mail ou CPF.' },
        { status: 409 },
      );
    }

    console.error('Falha ao criar conta:', error);
    return NextResponse.json(
      { error: 'Não foi possível criar sua conta. Tente novamente.' },
      { status: 500 },
    );
  }
}
