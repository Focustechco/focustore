import { prisma } from '@/lib/db/prisma';

export class OrderService {
  static async getOrdersByUserId(userId: string) {
    return prisma.order.findMany({
      where: { userId },
      include: {
        items: true,
        payments: true,
        shipments: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getOrderByNumber(orderNumber: string) {
    return prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: true,
        payments: true,
        shipments: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
        user: { select: { name: true, email: true, phone: true } },
      },
    });
  }

  static async getOrderById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
        shipments: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
        user: { select: { name: true, email: true, phone: true } },
      },
    });
  }

  static async updateOrderStatus(
    orderId: string,
    status: any,
    comment?: string,
    actorId?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id: orderId },
        data: { status },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status,
          comment: comment || `Status alterado para ${status}`,
          actorId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'UPDATE_ORDER_STATUS',
          entity: 'Order',
          entityId: orderId,
          metadata: JSON.stringify({ oldStatus: order.status, newStatus: status, comment }),
        },
      });

      return order;
    });
  }
}
