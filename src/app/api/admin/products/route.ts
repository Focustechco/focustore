import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { revalidatePath } from 'next/cache';

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

    const body = await request.json();
    const {
      name,
      slug,
      sku,
      description,
      shortDescription,
      brand = 'Focus',
      basePrice,
      promotionalPrice,
      costPrice,
      status = 'ACTIVE',
      isFeatured = false,
      weightGrams = 300,
      heightCm = 5,
      widthCm = 20,
      lengthCm = 20,
      categoryIds = [],
      collectionIds = [],
      images = [],
      variants = [],
    } = body;

    if (!name || !sku || basePrice === undefined) {
      return NextResponse.json(
        { success: false, error: 'Nome, SKU e Preço Base são obrigatórios.' },
        { status: 400 }
      );
    }

    const finalSlug =
      slug ||
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');

    // Check slug uniqueness
    const existing = await prisma.product.findFirst({
      where: { OR: [{ slug: finalSlug }, { sku }] },
    });
    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error:
            existing.slug === finalSlug
              ? 'Já existe um produto com este slug.'
              : 'Já existe um produto com este SKU.',
        },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        name,
        slug: finalSlug,
        sku,
        description: description || name,
        shortDescription: shortDescription || null,
        brand: brand || 'Focus',
        basePrice: Number(basePrice),
        promotionalPrice: promotionalPrice ? Number(promotionalPrice) : null,
        costPrice: costPrice ? Number(costPrice) : null,
        status: status || 'ACTIVE',
        isFeatured: Boolean(isFeatured),
        weightGrams: Number(weightGrams) || 300,
        heightCm: Number(heightCm) || 5,
        widthCm: Number(widthCm) || 20,
        lengthCm: Number(lengthCm) || 20,
        categories: {
          create: categoryIds.map((catId: string) => ({
            categoryId: catId,
          })),
        },
        collections: {
          create: collectionIds.map((colId: string, idx: number) => ({
            collectionId: colId,
            position: idx,
          })),
        },
        images: {
          create: images.map((img: any, idx: number) => ({
            url: typeof img === 'string' ? img : img.url,
            altText: typeof img === 'object' ? img.altText : name,
            position: idx,
            isPrimary: idx === 0,
          })),
        },
      },
    });

    // Create variants if provided
    if (Array.isArray(variants) && variants.length > 0) {
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const variantSku = v.sku || `${sku}-${v.color || 'STD'}-${v.size || i + 1}`;
        const createdVariant = await prisma.productVariant.create({
          data: {
            productId: product.id,
            sku: variantSku,
            name: v.name || `${product.name} - ${v.color || ''} ${v.size || ''}`.trim(),
            color: v.color || null,
            colorHex: v.colorHex || null,
            size: v.size || null,
            model: v.model || null,
            price: v.price ? Number(v.price) : Number(basePrice),
            promotionalPrice: v.promotionalPrice ? Number(v.promotionalPrice) : (promotionalPrice ? Number(promotionalPrice) : null),
            imageUrl: v.imageUrl || (images[0] ? (typeof images[0] === 'string' ? images[0] : images[0].url) : null),
            position: i,
            isActive: v.isActive !== undefined ? Boolean(v.isActive) : true,
          },
        });

        // Create inventory
        await prisma.inventory.create({
          data: {
            variantId: createdVariant.id,
            quantityAvailable: Number(v.stock ?? v.quantityAvailable ?? 50),
            quantityReserved: 0,
            lowStockThreshold: 5,
          },
        });
      }
    } else {
      // Default standard variant
      const defaultVariant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: `${sku}-STD`,
          name: `${product.name} - Padrão`,
          price: Number(basePrice),
          promotionalPrice: promotionalPrice ? Number(promotionalPrice) : null,
          imageUrl: images[0] ? (typeof images[0] === 'string' ? images[0] : images[0].url) : null,
          position: 0,
          isActive: true,
        },
      });

      await prisma.inventory.create({
        data: {
          variantId: defaultVariant.id,
          quantityAvailable: 50,
          quantityReserved: 0,
          lowStockThreshold: 5,
        },
      });
    }

    // Revalidate store paths
    revalidatePath('/');
    revalidatePath('/colecoes');
    revalidatePath('/categoria/[slug]', 'page');
    revalidatePath('/produto/[slug]', 'page');

    const createdFullProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: {
        images: true,
        variants: { include: { inventory: true } },
        categories: { include: { category: true } },
        collections: { include: { collection: true } },
      },
    });

    return NextResponse.json({ success: true, product: createdFullProduct }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao cadastrar produto.' },
      { status: 500 }
    );
  }
}
