import { prisma } from '@/lib/db/prisma';
import { InventoryService } from '../inventory/inventory.service';
import { logger } from '@/lib/utils/logger';

export class PaymentService {
  static async handlePaymentWebhook(payload: {
    eventId: string;
    eventType: string;
    orderId?: string;
    paymentId?: string;
    status: 'PAID' | 'FAILED' | 'CANCELLED';
    provider: string;
  }) {
    logger.info('Processando webhook de pagamento', { eventId: payload.eventId });

    // 1. Idempot?ncia: verificar se evento j? foi processado
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { eventId: payload.eventId },
    });

    if (existingEvent && existingEvent.processed) {
      logger.info('Evento j? processado anteriormente', { eventId: payload.eventId });
      return { status: 'already_processed' };
    }

    const webhookEvent = await prisma.webhookEvent.upsert({
      where: { eventId: payload.eventId },
      update: {},
      create: {
        eventId: payload.eventId,
        provider: payload.provider,
        eventType: payload.eventType,
        payload: JSON.stringify(payload),
      },
    });

    try {
      await prisma.$transaction(async (tx) => {
        let payment;
        if (payload.paymentId) {
          payment = await tx.payment.findUnique({
            where: { id: payload.paymentId },
            include: { order: true },
          });
        } else if (payload.orderId) {
          payment = await tx.payment.findFirst({
            where: { orderId: payload.orderId },
            include: { order: true },
          });
        }

        if (!payment) {
          throw new Error('Pagamento correspondente n?o encontrado.');
        }

        if (payload.status === 'PAID') {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'PAID',
              paidAt: new Date(),
            },
          });

          await tx.order.update({
            where: { id: payment.orderId },
            data: { status: 'PAID' },
          });

          await tx.orderStatusHistory.create({
            data: {
              orderId: payment.orderId,
              status: 'PAID',
              comment: `Pagamento confirmado via webhook do ${payload.provider}`,
            },
          });

          // Baixa definitiva no estoque
          await InventoryService.commitStock(tx, payment.orderId);
        } else if (payload.status === 'FAILED' || payload.status === 'CANCELLED') {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: 'FAILED' },
          });

          await tx.order.update({
            where: { id: payment.orderId },
            data: { status: 'CANCELLED' },
          });

          await tx.orderStatusHistory.create({
            data: {
              orderId: payment.orderId,
              status: 'CANCELLED',
              comment: 'Pagamento recusado ou cancelado pelo gateway.',
            },
          });

          // Libera estoque reservado de volta
          await InventoryService.releaseStock(tx, payment.orderId);
        }

        await tx.webhookEvent.update({
          where: { id: webhookEvent.id },
          data: {
            processed: true,
            processedAt: new Date(),
          },
        });
      });

      return { status: 'success' };
    } catch (err: any) {
      logger.error('Falha ao processar webhook', { error: err.message, eventId: payload.eventId });
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { error: err.message },
      });
      throw err;
    }
  }
}
