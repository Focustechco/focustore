import { NextResponse } from 'next/server';
import { z } from 'zod';
import { copySetCookie, fastApiRequestFromNextRequest } from '@/lib/auth/fastapi';

const registrationSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(100),
  email: z.string().trim().email('Informe um e-mail válido.').max(254),
  cpf: z.string().optional(),
  password: z.string().min(12, 'A senha deve ter ao menos 12 caracteres.').max(128),
});

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(
    { error: parsed.error.issues[0]?.message ?? 'Confira os dados informados.' }, { status: 400 });
  if (parsed.data.cpf?.trim()) return NextResponse.json(
    { error: 'CPF ainda não está disponível no cadastro.' }, { status: 400 });

  try {
    const backend = await fastApiRequestFromNextRequest(request, '/auth/register', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: parsed.data.name, email: parsed.data.email, password: parsed.data.password }),
    });
    const payload = await backend.json().catch(() => ({}));
    const response = NextResponse.json(
      backend.ok ? { user: payload } : { error: backend.status === 409 ? 'Não foi possível concluir o cadastro. Tente novamente.' : 'Não foi possível criar sua conta.' },
      { status: backend.status },
    );
    copySetCookie(backend, response);
    return response;
  } catch {
    console.error('Falha ao encaminhar cadastro para a API de identidade.');
    return NextResponse.json({ error: 'Não foi possível concluir o cadastro. Tente novamente.' }, { status: 503 });
  }
}
