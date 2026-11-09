import { NextResponse } from 'next/server';
import {
  fastApiRequestFromNextRequest,
  FastApiConfigurationError,
  FastApiConnectionError,
  FastApiOriginError,
} from '@/lib/auth/fastapi';

export async function POST(request: Request) {
  try {
    const backend = await fastApiRequestFromNextRequest(request, '/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(await request.json()),
    });
    const body = await backend.text();
    const headers = new Headers({
      'content-type': backend.headers.get('content-type') || 'application/json',
    });
    const correlationId = backend.headers.get('x-focus-correlation-id');
    if (correlationId) headers.set('x-focus-correlation-id', correlationId);
    return new NextResponse(body, {
      status: backend.status,
      headers,
    });
  } catch (error) {
    if (error instanceof FastApiOriginError) {
      return NextResponse.json({ error: 'Origem da requisição não permitida.' }, { status: 403 });
    }
    if (error instanceof FastApiConnectionError || error instanceof FastApiConfigurationError) {
      return NextResponse.json({ error: 'Pedidos temporariamente indisponíveis.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Não foi possível criar o pedido.' }, { status: 400 });
  }
}
