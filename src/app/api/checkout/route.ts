import { NextResponse } from 'next/server';
import { CheckoutService } from '@/modules/checkout/checkout.service';
import { rateLimit } from '@/lib/security/rate-limit';
import { getAuthenticatedUser } from '@/lib/auth/session';

export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin');
    const expectedOrigins = new Set([new URL(req.url).origin]);
    if (process.env.NEXT_PUBLIC_APP_URL) {
      expectedOrigins.add(process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ''));
    }
    if (req.headers.get('sec-fetch-site') === 'cross-site' || (origin && !expectedOrigins.has(origin))) {
      return NextResponse.json({ error: 'Origem da requisição não autorizada.' }, { status: 403 });
    }

    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const limitResult = rateLimit(`checkout_${ip}`, 10, 60 * 1000);
    if (!limitResult.success) {
      return NextResponse.json({ error: 'Muitas tentativas de checkout. Aguarde 1 minuto.' }, { status: 429 });
    }

    const body = await req.json();
    const authenticatedUser = await getAuthenticatedUser();
    const result = await CheckoutService.processCheckout({
      ...body,
      // Never trust an identity supplied by the browser. Guest checkout remains supported.
      userId: authenticatedUser?.id,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    console.error('Erro no checkout:', err);
    return NextResponse.json({ error: 'Falha ao processar checkout.' }, { status: 400 });
  }
}
