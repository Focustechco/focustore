import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { revalidatePath } from 'next/cache';
import { validateProductInput } from '@/modules/catalog/product-validation';

function isPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

export async function GET(request: Request) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.authorized) return authorization.response;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const categoryId = searchParams.get('categoryId') || undefined;
    const status = searchParams.get('status') || undefined;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { slug: { contains: search } },
      ];
    }
    if (categoryId) {
      where.categories = {
        some: { categoryId },
      };
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        images: { orderBy: { position: 'asc' } },
        variants: {
          include: { inventory: true },
          orderBy: { position: 'asc' },
        },
        categories: { include: { category: true } },
        collections: { include: { collection: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, products });
  } catch (error: any) {
    console.error('Error listing products:', error);
    return NextResponse.json(
      { success: false, error: 'Falha ao buscar produtos.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.authorized) return authorization.response;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Requisição inválida.' }, { status: 400 });
    }

    let input: ReturnType<typeof validateProductInput>;
    try {
      input = validateProductInput(rawBody);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Dados do produto inválidos.' },
        { status: 400 },
      );
    }

    const finalSlug =
      input.slug ||
      input.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');

    const product = await prisma.$transaction(async (transaction) => {
      const created = await transaction.product.create({
        data: {
          name: input.name,
          slug: finalSlug,
          sku: input.sku,
          description: input.description || input.name,
          shortDescription: input.shortDescription,
          brand: input.brand || 'Focus',
          basePrice: input.basePrice,
          promotionalPrice: input.promotionalPrice,
          costPrice: input.costPrice,
          status: input.status || 'ACTIVE',
          isFeatured: input.isFeatured ?? false,
          weightGrams: input.weightGrams ?? 300,
          heightCm: input.heightCm ?? 5,
          widthCm: input.widthCm ?? 20,
          lengthCm: input.lengthCm ?? 20,
          categories: {
            create: (input.categoryIds || []).map((categoryId) => ({ categoryId })),
          },
          collections: {
            create: (input.collectionIds || []).map((collectionId, position) => ({
              collectionId,
              position,
            })),
          },
          images: {
            create: (input.images || []).map((image, position) => ({
              url: typeof image === 'string' ? image : image.url,
              altText: typeof image === 'string' ? input.name : image.altText || input.name,
              position,
              isPrimary: position === 0,
            })),
          },
        },
      });

      const variants = input.variants?.length
        ? input.variants
        : [{ name: `${input.name} - Padrão`, sku: `${input.sku}-STD`, price: input.basePrice }];
      const firstImage = input.images?.[0];
      const defaultImageUrl = typeof firstImage === 'string' ? firstImage : firstImage?.url;

      for (const [position, variant] of variants.entries()) {
        const variantSku = variant.sku || `${input.sku}-${variant.color || 'VAR'}-${variant.size || position + 1}`;
        await transaction.productVariant.create({
          data: {
            productId: created.id,
            sku: variantSku,
            name: variant.name || `${input.name} - ${variant.color || ''} ${variant.size || ''}`.trim(),
            color: variant.color || null,
            colorHex: variant.colorHex || null,
            size: variant.size || null,
            model: variant.model || null,
            price: variant.price ?? input.basePrice,
            promotionalPrice: variant.promotionalPrice ?? input.promotionalPrice,
            imageUrl: variant.imageUrl ?? defaultImageUrl ?? null,
            position,
            isActive: variant.isActive ?? true,
            inventory: {
              create: {
                quantityAvailable: variant.stock ?? variant.quantityAvailable ?? 0,
                quantityReserved: 0,
                lowStockThreshold: 5,
              },
            },
          },
        });
      }

      return transaction.product.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          images: true,
          variants: { include: { inventory: true } },
          categories: { include: { category: true } },
          collections: { include: { collection: true } },
        },
      });
    });

    // Revalidate store paths
    revalidatePath('/');
    revalidatePath('/colecoes');
    revalidatePath('/categoria/[slug]', 'page');
    revalidatePath('/produto/[slug]', 'page');

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    if (isPrismaCode(error, 'P2002')) {
      return NextResponse.json(
        { success: false, error: 'Já existe um produto ou variante com este SKU ou slug.' },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { success: false, error: 'Erro ao cadastrar produto.' },
      { status: 500 }
    );
  }
}
