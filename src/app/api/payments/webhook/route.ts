import { NextResponse } from 'next/server';
import { PaymentService } from '@/modules/payments/payment.service';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { sameOrigin } from '@/lib/security/origin';

export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Webhook fictício desativado em produção.' },
        { status: 503 }
      );
    }

    if (!sameOrigin(req)) {
      return NextResponse.json({ error: 'Request origin is not authorized.' }, { status: 403 });
    }
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 });
    const payload = await req.json();
    if (typeof payload.orderId !== 'string') {
      return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
    }
    const order = await prisma.order.findUnique({
      where: { id: payload.orderId },
      select: { userId: true },
    });
    if (!order || order.userId !== user.id) {
      return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 403 });
    }

    const result = await PaymentService.handlePaymentWebhook({
      eventId: payload.eventId || payload.id || `evt_${Date.now()}`,
      eventType: payload.eventType || payload.type || 'payment.updated',
      orderId: payload.orderId || payload.data?.orderId,
      paymentId: payload.paymentId || payload.data?.paymentId,
      status: payload.status === 'approved' || payload.status === 'PAID' ? 'PAID' : 'FAILED',
      provider: payload.provider || 'gateway_webhook',
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Payment webhook error:', err);
    return NextResponse.json({ error: 'Falha ao processar webhook.' }, { status: 400 });
  }
}
