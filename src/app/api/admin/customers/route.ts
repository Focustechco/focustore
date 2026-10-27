import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: Request) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.authorized) return authorization.response;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const role = searchParams.get('role') || undefined;

    const where: any = {};
    if (role && role !== 'ALL') {
      where.role = role;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { cpf: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        addresses: { orderBy: { isDefault: 'desc' } },
        orders: {
          select: {
            id: true,
            total: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            orders: true,
            reviews: true,
            couponUsages: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate customer metrics
    const customersWithStats = users.map((u) => {
      const totalSpent = u.orders
        .filter((o) => o.status !== 'CANCELLED')
        .reduce((sum, o) => sum + o.total, 0);

      const lastOrder = u.orders[0] || null;

      return {
        id: u.id,
        name: u.name || 'Cliente Sem Nome',
        email: u.email,
        phone: u.phone,
        cpf: u.cpf,
        role: u.role,
        image: u.image,
        createdAt: u.createdAt,
        addresses: u.addresses,
        totalOrders: u._count.orders,
        totalReviews: u._count.reviews,
        totalSpent: Number(totalSpent.toFixed(2)),
        lastOrderDate: lastOrder?.createdAt || null,
        lastOrderStatus: lastOrder?.status || null,
      };
    });

    return NextResponse.json({ success: true, customers: customersWithStats });
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { success: false, error: 'Falha ao buscar clientes.' },
      { status: 500 }
    );
  }
}
