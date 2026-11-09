import { NextResponse } from 'next/server';
import { fastApiRequestFromNextRequest, FastApiConnectionError, FastApiConfigurationError, FastApiOriginError } from '@/lib/auth/fastapi';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const backend = await fastApiRequestFromNextRequest(request, '/cart/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await backend.text();
    return new NextResponse(body, {
      status: backend.status,
      headers: { 'content-type': backend.headers.get('content-type') || 'application/json' },
    });
  } catch (error) {
    if (error instanceof FastApiOriginError) {
      return NextResponse.json({ error: 'Origem da requisição não permitida.' }, { status: 403 });
    }
    if (error instanceof FastApiConnectionError || error instanceof FastApiConfigurationError) {
      return NextResponse.json({ error: 'Catálogo temporariamente indisponível.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Não foi possível validar o carrinho.' }, { status: 400 });
  }
}
