import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: Request) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.authorized) return authorization.response;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const categoryId = searchParams.get('categoryId') || undefined;
    const status = searchParams.get('status') || undefined;

    const where: any = {};
    if (search) {
      where.OR = [
        { sku: { contains: search } },
        { name: { contains: search } },
        { product: { name: { contains: search } } },
      ];
    }
    if (categoryId) {
      where.product = {
        categories: { some: { categoryId } },
      };
    }

    const variants = await prisma.productVariant.findMany({
      where,
      include: {
        product: {
          include: {
            images: { orderBy: { position: 'asc' }, take: 1 },
            categories: { include: { category: true } },
          },
        },
        inventory: {
          include: {
            movements: {
              take: 5,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
      orderBy: [{ product: { name: 'asc' } }, { position: 'asc' }],
    });

    // Filter by stock status if requested
    let filteredVariants = variants;
    if (status === 'OUT_OF_STOCK') {
      filteredVariants = variants.filter(
        (v) => (v.inventory?.quantityAvailable || 0) <= 0
      );
    } else if (status === 'LOW_STOCK') {
      filteredVariants = variants.filter((v) => {
        const qty = v.inventory?.quantityAvailable || 0;
        const threshold = v.inventory?.lowStockThreshold || 5;
        return qty > 0 && qty <= threshold;
      });
    } else if (status === 'IN_STOCK') {
      filteredVariants = variants.filter((v) => {
        const qty = v.inventory?.quantityAvailable || 0;
        const threshold = v.inventory?.lowStockThreshold || 5;
        return qty > threshold;
      });
    }

    return NextResponse.json({ success: true, variants: filteredVariants });
  } catch (error: any) {
    console.error('Error fetching inventory:');
    return NextResponse.json(
      { success: false, error: 'Falha ao buscar estoque.' },
      { status: 500 }
    );
  }
}
