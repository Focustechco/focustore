import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { InventoryService } from '../inventory/inventory.service';
import { InputError } from '@/lib/security/input-error';

const eventSchema = z.object({
  eventId: z.string().min(1).max(200), eventType: z.string().min(1).max(100),
  orderId: z.string().min(1).optional(), paymentId: z.string().min(1).optional(),
  status: z.enum(['PAID', 'FAILED', 'CANCELLED']), provider: z.string().min(1).max(100),
}).refine(value => value.orderId || value.paymentId);

export class PaymentService {
  // Demonstration only. Real providers require verified signatures before this call.
  static async handlePaymentWebhook(input: z.input<typeof eventSchema>) {
    const parsed = eventSchema.safeParse(input);
    if (!parsed.success) throw new InputError('Evento de pagamento inválido.');
    const payload = parsed.data;
    return prisma.$transaction(async tx => {
      const existing = await tx.webhookEvent.findUnique({ where: { eventId: payload.eventId } });
      const serialized = JSON.stringify(payload);
      if (existing && existing.payload !== serialized) throw new InputError('Evento reutilizado com dados diferentes.', 409);
      if (existing?.processed) return { status: 'already_processed' };
      const payment = payload.paymentId
        ? await tx.payment.findUnique({ where: { id: payload.paymentId } })
        : await tx.payment.findFirst({ where: { orderId: payload.orderId }, orderBy: { createdAt: 'desc' } });
      if (!payment || (payload.orderId && payload.orderId !== payment.orderId)) {
        throw new InputError('Pagamento não encontrado.', 404);
      }
      const event = await tx.webhookEvent.upsert({
        where: { eventId: payload.eventId }, update: {},
        create: { eventId: payload.eventId, provider: payload.provider,
                  eventType: payload.eventType, payload: serialized },
      });
      if (payment.status !== 'PENDING') {
        if (payment.status !== payload.status) throw new InputError('Transição de pagamento inválida.', 409);
      } else {
        const changed = await tx.payment.updateMany({
          where: { id: payment.id, status: 'PENDING' },
          data: { status: payload.status, paidAt: payload.status === 'PAID' ? new Date() : null },
        });
        if (changed.count !== 1) throw new InputError('Pagamento alterado. Tente novamente.', 409);
        const orderStatus = payload.status === 'PAID' ? 'PAID' : 'CANCELLED';
        await tx.order.update({ where: { id: payment.orderId }, data: { status: orderStatus } });
        await tx.orderStatusHistory.create({ data: {
          orderId: payment.orderId, status: orderStatus, comment: 'Evento de pagamento demonstrativo.',
        } });
        if (payload.status === 'PAID') await InventoryService.commitStock(tx, payment.orderId);
        else await InventoryService.releaseStock(tx, payment.orderId);
      }
      await tx.webhookEvent.update({ where: { id: event.id }, data: { processed: true, processedAt: new Date() } });
      return { status: 'success' };
    });
  }
}
