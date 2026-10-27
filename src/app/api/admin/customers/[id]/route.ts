import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.authorized) return authorization.response;

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        addresses: { orderBy: { isDefault: 'desc' } },
        orders: {
          include: {
            items: { include: { variant: { include: { product: true } } } },
            payments: true,
            shipments: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        reviews: {
          include: { product: { select: { name: true, slug: true } } },
          orderBy: { createdAt: 'desc' },
        },
        couponUsages: {
          include: { coupon: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Cliente não encontrado.' },
        { status: 404 }
      );
    }

    const totalSpent = (user.orders || [])
      .filter((o: any) => o.status !== 'CANCELLED')
      .reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const { passwordHash: _passwordHash, ...customerData } = user;

    return NextResponse.json({
      success: true,
      customer: {
        ...customerData,
        totalSpent: Number(totalSpent.toFixed(2)),
      },
    });
  } catch (error: any) {
    console.error('Error fetching customer details:');
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar detalhes do cliente.' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.authorized) return authorization.response;

    const { id } = await params;
    const body = await request.json();
    const { name, phone, cpf, role } = body;

    if (role !== undefined && authorization.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Somente administradores podem alterar papéis.' },
        { status: 403 }
      );
    }
    if (role !== undefined && !['CUSTOMER', 'MANAGER', 'ADMIN'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Papel inválido.' },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(cpf !== undefined ? { cpf } : {}),
        ...(role !== undefined ? { role } : {}),
      },
    });

    return NextResponse.json({ success: true, customer: updated });
  } catch (error: any) {
    console.error('Error updating customer:');
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar cliente.' },
      { status: 500 }
    );
  }
}
