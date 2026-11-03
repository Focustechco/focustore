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
    const coupon = await prisma.coupon.findUnique({
      where: { id },
      include: {
        _count: { select: { usages: true } },
        usages: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { name: true, email: true } },
            order: { select: { id: true, total: true, status: true, createdAt: true } },
          },
        },
      },
    });

    if (!coupon) {
      return NextResponse.json(
        { success: false, error: 'Cupom não encontrado.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, coupon });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar cupom.' },
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

    const {
      code,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscount,
      usageLimit,
      isActive,
      startsAt,
      expiresAt,
    } = body;

    const existing = await prisma.coupon.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Cupom não encontrado.' },
        { status: 404 }
      );
    }

    const dataToUpdate: any = {};

    if (code !== undefined) {
      const formattedCode = code.toUpperCase().trim().replace(/\s+/g, '');
      if (formattedCode !== existing.code) {
        const codeTaken = await prisma.coupon.findUnique({
          where: { code: formattedCode },
        });
        if (codeTaken) {
          return NextResponse.json(
            { success: false, error: `O código "${formattedCode}" já está em uso.` },
            { status: 400 }
          );
        }
      }
      dataToUpdate.code = formattedCode;
    }

    if (discountType !== undefined) {
      dataToUpdate.discountType = discountType;
      if (discountType === 'FREE_SHIPPING') {
        dataToUpdate.discountValue = 0;
      }
    }

    if (discountValue !== undefined && discountType !== 'FREE_SHIPPING') {
      dataToUpdate.discountValue = Number(discountValue);
    }

    if (minOrderAmount !== undefined) {
      dataToUpdate.minOrderAmount = minOrderAmount ? Number(minOrderAmount) : null;
    }

    if (maxDiscount !== undefined) {
      dataToUpdate.maxDiscount = maxDiscount ? Number(maxDiscount) : null;
    }

    if (usageLimit !== undefined) {
      dataToUpdate.usageLimit = usageLimit ? Number(usageLimit) : null;
    }

    if (isActive !== undefined) {
      dataToUpdate.isActive = Boolean(isActive);
    }

    if (startsAt !== undefined) {
      dataToUpdate.startsAt = startsAt ? new Date(startsAt) : null;
    }

    if (expiresAt !== undefined) {
      dataToUpdate.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    const updated = await prisma.coupon.update({
      where: { id },
      data: dataToUpdate,
      include: {
        _count: { select: { usages: true } },
      },
    });

    return NextResponse.json({ success: true, coupon: updated });
  } catch (error: any) {
    console.error('Error updating coupon:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao atualizar cupom.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.authorized) return authorization.response;

    const { id } = await params;
    const existing = await prisma.coupon.findUnique({
      where: { id },
      include: { _count: { select: { usages: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Cupom não encontrado.' },
        { status: 404 }
      );
    }

    // Delete coupon usages or cascade
    await prisma.couponUsage.deleteMany({ where: { couponId: id } });
    await prisma.coupon.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Cupom excluído com sucesso.',
    });
  } catch (error: any) {
    console.error('Error deleting coupon:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao excluir cupom.' },
      { status: 500 }
    );
  }
}
