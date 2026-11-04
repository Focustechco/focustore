import { prisma } from '@/lib/db/prisma';

export class AdminService {
  static async getDashboardStats() {
    const paidStatuses = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
    const [
      totalRevenueResult,
      totalOrders,
      paidOrders,
      totalCustomers,
      lowStockVariants,
      recentOrders,
      productsCount,
    ] = await Promise.all([
      prisma.order.aggregate({
        where: { status: { in: paidStatuses } },
        _sum: { total: true },
      }),
      prisma.order.count(),
      prisma.order.count({ where: { status: { in: paidStatuses } } }),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.productVariant.findMany({
        where: { inventory: { quantityAvailable: { lte: 10 } } },
        include: { product: true, inventory: true },
        orderBy: { inventory: { quantityAvailable: 'asc' } },
        take: 5,
      }),
      prisma.order.findMany({
        include: { items: true, payments: true },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      prisma.product.count(),
    ]);
    const totalRevenue = totalRevenueResult._sum.total ?? 0;

    return {
      totalRevenue,
      totalOrders,
      paidOrders,
      totalCustomers,
      averageTicket: paidOrders > 0 ? totalRevenue / paidOrders : 0,
      productsCount,
      lowStockVariants,
      recentOrders,
    };
  }

  static async logAudit(actorId: string | undefined, action: string, entity: string, entityId: string, metadata?: any) {
    try {
      return await prisma.auditLog.create({
        data: {
          actorId,
          action,
          entity,
          entityId,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });
    } catch (error) {
      console.error('Error logging audit:', error);
      return null;
    }
  }
}
