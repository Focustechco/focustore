import { NextResponse } from 'next/server';
import { z } from 'zod';
import { copySetCookie, fastApiRequestFromNextRequest } from '@/lib/auth/fastapi';

const loginSchema = z.object({
  identifier: z.string().trim().email('Informe um e-mail válido.').max(254),
  password: z.string().min(1, 'Informe sua senha.').max(128),
  remember: z.boolean().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(
    { error: parsed.error.issues[0]?.message ?? 'Confira os dados informados.' }, { status: 400 });

  try {
    const backend = await fastApiRequestFromNextRequest(request, '/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: parsed.data.identifier, password: parsed.data.password }),
    });
    const payload = await backend.json().catch(() => ({}));
    const response = NextResponse.json(
      backend.ok ? { user: payload } : { error: 'Não foi possível entrar. Verifique seus dados.' },
      { status: backend.status },
    );
    copySetCookie(backend, response);
    return response;
  } catch {
    console.error('Falha ao encaminhar login para a API de identidade.');
    return NextResponse.json({ error: 'Não foi possível entrar. Tente novamente.' }, { status: 503 });
  }
}
