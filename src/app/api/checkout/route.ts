import { NextResponse } from 'next/server';
import { CheckoutService } from '@/modules/checkout/checkout.service';
import { rateLimit } from '@/lib/security/rate-limit';

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const limitResult = rateLimit(`checkout_${ip}`, 10, 60 * 1000);
    if (!limitResult.success) {
      return NextResponse.json({ error: 'Muitas tentativas de checkout. Aguarde 1 minuto.' }, { status: 429 });
    }

    const body = await req.json();
    const result = await CheckoutService.processCheckout(body);

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    console.error('Erro no checkout:', err);
    return NextResponse.json({ error: err.message || 'Falha ao processar checkout' }, { status: 400 });
  }
}