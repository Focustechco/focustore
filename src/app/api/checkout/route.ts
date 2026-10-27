import { NextResponse } from 'next/server';
import { CheckoutService } from '@/modules/checkout/checkout.service';
import { rateLimit } from '@/lib/security/rate-limit';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { InputError } from '@/lib/security/input-error';
import { grantGuestOrder } from '@/lib/auth/guest-order';
import { sameOrigin } from '@/lib/security/origin';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Origem inválida.' }, { status: 403 });
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Pagamento real ainda não configurado.' }, { status: 503 });
    }
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const limitResult = rateLimit(`checkout_${ip}`, 10, 60 * 1000);
    if (!limitResult.success) {
      return NextResponse.json({ error: 'Muitas tentativas de checkout. Aguarde 1 minuto.' }, { status: 429 });
    }

    const body = await req.json();
    const user = await getAuthenticatedUser();
    const result = await CheckoutService.processCheckout({ ...body, userId: user?.id });

    const response = NextResponse.json(result, { status: 201 });
    if (!user) {
      response.cookies.set('focus_guest_order', grantGuestOrder(result.order.id), {
        httpOnly: true, sameSite: 'lax', path: '/checkout/confirmacao', maxAge: 7200,
        secure: false, // This demonstration route is disabled in production above.
      });
    }
    return response;
  } catch (err) {
    return NextResponse.json({ error: err instanceof InputError ? err.message : 'Falha ao processar checkout.' },
                            { status: err instanceof InputError ? err.status : err instanceof SyntaxError ? 400 : 500 });
  }
}
