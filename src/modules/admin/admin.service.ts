import { prisma } from '@/lib/db/prisma';

export class AdminService {
  static async getDashboardStats() {
    const totalRevenueResult = await prisma.order.aggregate({
      where: { status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
      _sum: { total: true },
    });
    const totalRevenue = totalRevenueResult._sum.total || 0;

    const totalOrders = await prisma.order.count();
    const paidOrders = await prisma.order.count({
      where: { status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
    });
    const totalCustomers = await prisma.user.count({
      where: { role: 'CUSTOMER' },
    });

    const averageTicket = paidOrders > 0 ? totalRevenue / paidOrders : 0;

    const lowStockVariants = await prisma.productVariant.findMany({
      where: {
        inventory: {
          quantityAvailable: { lte: 10 },
        },
      },
      include: {
        product: true,
        inventory: true,
      },
      take: 5,
    });

    const recentOrders = await prisma.order.findMany({
      include: {
        items: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    const productsCount = await prisma.product.count();

    return {
      totalRevenue,
      totalOrders,
      paidOrders,
      totalCustomers,
      averageTicket,
      productsCount,
      lowStockVariants,
      recentOrders,
    };
  }

  static async logAudit(actorId: string | undefined, action: string, entity: string, entityId: string, metadata?: any) {
    return prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  }
}
