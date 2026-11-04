import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { canReadGuestOrder, guestPaymentCookieName } from '@/lib/auth/guest-order';
import { sameOrigin } from '@/lib/security/origin';
import { prisma } from '@/lib/db/prisma';
import { PaymentProcessingError, PaymentService } from '@/modules/payments/payment.service';

const webhookSchema = z.object({
  orderId: z.string().trim().min(1).max(100),
  eventId: z.string().trim().min(1).max(200).optional(),
  eventType: z.string().trim().min(1).max(100).optional(),
  status: z.enum(['approved', 'PAID', 'FAILED', 'CANCELLED']),
});

export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Webhook fictício desativado em produção.' },
        { status: 503 }
      );
    }

    const user = await getAuthenticatedUser();
    const payload: unknown = await req.json();
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      return NextResponse.json({ error: 'Dados de pagamento inválidos.' }, { status: 400 });
    }

    const body = payload as Record<string, unknown>;
    const orderId = typeof body.orderId === 'string' ? body.orderId : '';
    if (!orderId) {
      return NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 });
    }

    const parsed = webhookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados de pagamento inválidos.' }, { status: 400 });
    }

    const guestToken = (await cookies()).get(guestPaymentCookieName(orderId))?.value;
    const guestOwnsOrder = canReadGuestOrder(guestToken, orderId);
    if (!user && !guestOwnsOrder) {
      return NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true },
    });
    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
    }

    if (order.userId ? user?.id !== order.userId : !guestOwnsOrder) {
      return NextResponse.json({ error: 'Acesso não autorizado a este pedido.' }, { status: 403 });
    }

    if (!sameOrigin(req)) {
      return NextResponse.json({ error: 'Origem da requisição não autorizada.' }, { status: 403 });
    }

    const payment = await prisma.payment.findFirst({
      where: { orderId },
      select: { id: true },
    });
    if (!payment) {
      return NextResponse.json({ error: 'Pagamento não encontrado.' }, { status: 404 });
    }

    const eventId = parsed.data.eventId || randomUUID();
    const eventType = parsed.data.eventType || 'development.payment.simulated';

    const result = await PaymentService.handlePaymentWebhook({
      eventId,
      eventType,
      orderId,
      paymentId: payment.id,
      status: parsed.data.status === 'approved' || parsed.data.status === 'PAID'
        ? 'PAID'
        : parsed.data.status,
      provider: 'development-simulator',
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Falha ao processar simulação de pagamento:', error);
    if (error instanceof PaymentProcessingError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Não foi possível processar o pagamento.' }, { status: 500 });
  }
}