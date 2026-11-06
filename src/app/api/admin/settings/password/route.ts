import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/admin';
import { AUTH_COOKIE_NAME } from '@/lib/auth/session';
import { sameOrigin } from '@/lib/security/origin';
import { prisma } from '@/lib/db/prisma';

class PasswordChangedConcurrentlyError extends Error {}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1).max(72),
    newPassword: z
      .string()
      .min(8, 'A nova senha deve ter pelo menos 8 caracteres.')
      .max(72, 'A nova senha deve ter no máximo 72 caracteres.')
      .refine(
        (password) => Buffer.byteLength(password, 'utf8') <= 72,
        'A nova senha deve ter no máximo 72 bytes em UTF-8.',
      ),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    path: ['newPassword'],
    message: 'A nova senha deve ser diferente da senha atual.',
  });

export async function POST(request: Request) {
  const authorization = await requireAdmin();
  if (!authorization.authorized) return authorization.response;

  if (!sameOrigin(request)) {
    return NextResponse.json(
      { success: false, error: 'Origem da requisição não autorizada.' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Requisição inválida.' },
      { status: 400 },
    );
  }

  const parsed = passwordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Confira os dados informados.',
      },
      { status: 400 },
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: authorization.userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      return NextResponse.json(
        { success: false, error: 'Esta conta não possui uma senha local para alterar.' },
        { status: 400 },
      );
    }

    if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
      return NextResponse.json(
        { success: false, error: 'A senha atual está incorreta.' },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    const newSessionToken = randomBytes(32).toString('hex');
    await prisma.$transaction(async (transaction) => {
      const update = await transaction.user.updateMany({
        where: {
          id: authorization.userId,
          passwordHash: user.passwordHash,
        },
        data: { passwordHash },
      });
      if (update.count !== 1) {
        throw new PasswordChangedConcurrentlyError();
      }
      await transaction.session.update({
        where: { sessionToken: authorization.sessionToken },
        data: { sessionToken: newSessionToken },
      });
      await transaction.session.deleteMany({
        where: {
          userId: authorization.userId,
          sessionToken: { not: newSessionToken },
        },
      });
    });

    const response = NextResponse.json({
      success: true,
      message: 'Senha alterada. As outras sessões foram encerradas.',
    });
    response.cookies.set(AUTH_COOKIE_NAME, newSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.max(
        0,
        Math.ceil((authorization.sessionExpires.getTime() - Date.now()) / 1000),
      ),
    });
    return response;
  } catch (error) {
    if (error instanceof PasswordChangedConcurrentlyError) {
      return NextResponse.json(
        { success: false, error: 'A senha foi alterada em outra sessão. Entre novamente e tente de novo.' },
        { status: 409 },
      );
    }
    console.error('Error changing admin password:', error);
    return NextResponse.json(
      { success: false, error: 'Não foi possível alterar a senha.' },
      { status: 500 },
    );
  }
}
