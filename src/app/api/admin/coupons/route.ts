import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: Request) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.authorized) return authorization.response;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;

    const where: any = {};
    if (search) {
      where.code = { contains: search.toUpperCase() };
    }
    if (status === 'ACTIVE') {
      where.isActive = true;
    } else if (status === 'INACTIVE') {
      where.isActive = false;
    }

    const coupons = await prisma.coupon.findMany({
      where,
      include: {
        _count: { select: { usages: true } },
        usages: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, coupons });
  } catch (error: any) {
    console.error('Error listing coupons:');
    return NextResponse.json(
      { success: false, error: 'Falha ao buscar cupons.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.authorized) return authorization.response;

    const body = await request.json();
    const {
      code,
      discountType = 'PERCENTAGE',
      discountValue = 10,
      minOrderAmount,
      maxDiscount,
      usageLimit,
      isActive = true,
      startsAt,
      expiresAt,
    } = body;

    if (!code || !code.trim()) {
      return NextResponse.json(
        { success: false, error: 'O código do cupom é obrigatório.' },
        { status: 400 }
      );
    }

    const formattedCode = code.toUpperCase().trim().replace(/\s+/g, '');

    // Check duplicate
    const existing = await prisma.coupon.findUnique({
      where: { code: formattedCode },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `O cupom "${formattedCode}" já existe.` },
        { status: 400 }
      );
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: formattedCode,
        discountType,
        discountValue: discountType === 'FREE_SHIPPING' ? 0 : Number(discountValue),
        minOrderAmount: minOrderAmount ? Number(minOrderAmount) : null,
        maxDiscount: maxDiscount ? Number(maxDiscount) : null,
        usageLimit: usageLimit ? Number(usageLimit) : null,
        usageCount: 0,
        isActive: Boolean(isActive),
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        _count: { select: { usages: true } },
      },
    });

    return NextResponse.json({ success: true, coupon }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating coupon:');
    return NextResponse.json(
      { success: false, error: 'Erro ao criar cupom.' },
      { status: 500 }
    );
  }
}
