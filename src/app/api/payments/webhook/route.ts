import { requireAdmin } from '@/lib/auth/admin';
import { InputError } from '@/lib/security/input-error';
import { NextResponse } from 'next/server';
import { PaymentService } from '@/modules/payments/payment.service';

export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Webhook fictício desativado em produção.' },
        { status: 503 }
      );
    }

    const authorization = await requireAdmin();
    if (!authorization.authorized) return authorization.response;
    const payload = await req.json();

    const result = await PaymentService.handlePaymentWebhook({
      eventId: payload.eventId || payload.id,
      eventType: payload.eventType || payload.type || 'payment.updated',
      orderId: payload.orderId || payload.data?.orderId,
      paymentId: payload.paymentId || payload.data?.paymentId,
      status: payload.status === 'approved' ? 'PAID' : payload.status,
      provider: payload.provider || 'gateway_webhook',
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof InputError ? err.message : 'Falha ao processar evento.' },
                            { status: err instanceof InputError ? err.status : err instanceof SyntaxError ? 400 : 500 });
  }
}
