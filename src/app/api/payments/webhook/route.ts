import { NextResponse } from 'next/server';
import { PaymentService } from '@/modules/payments/payment.service';

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    const result = await PaymentService.handlePaymentWebhook({
      eventId: payload.eventId || payload.id || `evt_${Date.now()}`,
      eventType: payload.eventType || payload.type || 'payment.updated',
      orderId: payload.orderId || payload.data?.orderId,
      paymentId: payload.paymentId || payload.data?.paymentId,
      status: payload.status === 'approved' || payload.status === 'PAID' ? 'PAID' : 'FAILED',
      provider: payload.provider || 'gateway_webhook',
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}