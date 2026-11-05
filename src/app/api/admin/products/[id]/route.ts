import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { validateProductInput } from '@/modules/catalog/product-validation';

class InvalidProductVariantError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.authorized) return authorization.response;

    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { position: 'asc' } },
        variants: {
          include: { inventory: true },
          orderBy: { position: 'asc' },
        },
        categories: { include: { category: true } },
        collections: { include: { collection: true } },
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, product });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar produto.' },
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
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Requisição inválida.' }, { status: 400 });
    }
    if (!isRecord(rawBody)) {
      return NextResponse.json({ success: false, error: 'Dados do produto inválidos.' }, { status: 400 });
    }
    const body = rawBody;

    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: { variants: true },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado.' },
        { status: 404 }
      );
    }

    let input: ReturnType<typeof validateProductInput>;
    try {
      input = validateProductInput({ ...existingProduct, ...body });
    } catch (error) {
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Dados do produto inválidos.' },
        { status: 400 },
      );
    }

    const dataToUpdate: Prisma.ProductUpdateInput = {};
    if (body.name !== undefined) dataToUpdate.name = input.name;
    if (body.slug !== undefined) dataToUpdate.slug = input.slug || '';
    if (body.sku !== undefined) dataToUpdate.sku = input.sku;
    if (body.description !== undefined) dataToUpdate.description = input.description || '';
    if (body.shortDescription !== undefined) dataToUpdate.shortDescription = input.shortDescription;
    if (body.brand !== undefined) dataToUpdate.brand = input.brand || 'Focus';
    if (body.basePrice !== undefined) dataToUpdate.basePrice = input.basePrice;
    if (body.promotionalPrice !== undefined) dataToUpdate.promotionalPrice = input.promotionalPrice;
    if (body.costPrice !== undefined) dataToUpdate.costPrice = input.costPrice;
    if (body.status !== undefined) dataToUpdate.status = input.status || 'ACTIVE';
    if (body.isFeatured !== undefined) dataToUpdate.isFeatured = input.isFeatured ?? false;
    if (body.weightGrams !== undefined) dataToUpdate.weightGrams = input.weightGrams ?? 0;
    if (body.heightCm !== undefined) dataToUpdate.heightCm = input.heightCm ?? 0;
    if (body.widthCm !== undefined) dataToUpdate.widthCm = input.widthCm ?? 0;
    if (body.lengthCm !== undefined) dataToUpdate.lengthCm = input.lengthCm ?? 0;

    await prisma.$transaction(async (transaction) => {
      await transaction.product.update({
        where: { id },
        data: dataToUpdate,
      });

      if (input.categoryIds !== undefined) {
        await transaction.productCategory.deleteMany({ where: { productId: id } });
        if (input.categoryIds.length > 0) {
          await transaction.productCategory.createMany({
            data: input.categoryIds.map((categoryId) => ({ productId: id, categoryId })),
          });
        }
      }

      if (input.collectionIds !== undefined) {
        await transaction.collectionProduct.deleteMany({ where: { productId: id } });
        if (input.collectionIds.length > 0) {
          await transaction.collectionProduct.createMany({
            data: input.collectionIds.map((collectionId, position) => ({
              productId: id,
              collectionId,
              position,
            })),
          });
        }
      }

      if (input.images !== undefined) {
        await transaction.productImage.deleteMany({ where: { productId: id } });
        if (input.images.length > 0) {
          await transaction.productImage.createMany({
            data: input.images.map((image, position) => ({
              productId: id,
              url: typeof image === 'string' ? image : image.url,
              altText: typeof image === 'string' ? input.name : image.altText || input.name,
              position,
              isPrimary: position === 0,
            })),
          });
        }
      }

      if (input.variants !== undefined) {
        const existingVariantIds = input.variants.flatMap((variant) => variant.id ? [variant.id] : []);
        if (existingVariantIds.length > 0) {
          const ownedVariants = await transaction.productVariant.findMany({
            where: { id: { in: existingVariantIds }, productId: id },
            select: { id: true },
          });
          if (ownedVariants.length !== existingVariantIds.length) {
            throw new InvalidProductVariantError('Uma ou mais variantes não pertencem a este produto.');
          }
        }

        for (const [position, variant] of input.variants.entries()) {
          if (variant.id) {
            const variantData: Prisma.ProductVariantUpdateInput = { position };
            if (variant.name !== undefined) variantData.name = variant.name;
            if (variant.sku !== undefined) variantData.sku = variant.sku;
            if (variant.color !== undefined) variantData.color = variant.color || null;
            if (variant.colorHex !== undefined) variantData.colorHex = variant.colorHex || null;
            if (variant.size !== undefined) variantData.size = variant.size || null;
            if (variant.model !== undefined) variantData.model = variant.model || null;
            if (variant.price !== undefined) {
              const existingVariant = existingProduct.variants.find((item) => item.id === variant.id);
              const basePriceWasChanged =
                body.basePrice !== undefined &&
                Number(body.basePrice) !== Number(existingProduct.basePrice);
              const variantFollowedOldBasePrice =
                existingVariant &&
                Math.abs(Number(variant.price) - Number(existingVariant.price)) < 0.001 &&
                Math.abs(Number(existingVariant.price) - Number(existingProduct.basePrice)) < 0.001;
              variantData.price =
                basePriceWasChanged && variantFollowedOldBasePrice
                  ? Number(body.basePrice)
                  : variant.price;
            }
            if (variant.promotionalPrice !== undefined) variantData.promotionalPrice = variant.promotionalPrice;
            if (variant.imageUrl !== undefined) variantData.imageUrl = variant.imageUrl;
            if (variant.isActive !== undefined) variantData.isActive = variant.isActive;
            await transaction.productVariant.update({
              where: { id: variant.id },
              data: variantData,
            });

            if (variant.stock !== undefined) {
              await transaction.inventory.upsert({
                where: { variantId: variant.id },
                update: { quantityAvailable: variant.stock },
                create: {
                  variantId: variant.id,
                  quantityAvailable: variant.stock,
                  quantityReserved: 0,
                  lowStockThreshold: 5,
                },
              });
            }
          } else {
            const variantSku = variant.sku || `${input.sku}-${variant.color || 'VAR'}-${variant.size || position + 1}`;
            await transaction.productVariant.create({
              data: {
                productId: id,
                sku: variantSku,
                name: variant.name || `${input.name} - ${variant.color || ''} ${variant.size || ''}`.trim(),
                color: variant.color || null,
                colorHex: variant.colorHex || null,
                size: variant.size || null,
                model: variant.model || null,
                price: variant.price ?? input.basePrice,
                promotionalPrice: variant.promotionalPrice ?? input.promotionalPrice,
                imageUrl: variant.imageUrl || null,
                position,
                isActive: variant.isActive ?? true,
                inventory: {
                  create: {
                    quantityAvailable: variant.stock ?? 0,
                    quantityReserved: 0,
                    lowStockThreshold: 5,
                  },
                },
              },
            });
          }
        }
      }
    });

    // Comprehensive store revalidation
    revalidatePath('/');
    revalidatePath('/colecoes');
    revalidatePath(`/colecao/[slug]`, 'page');
    revalidatePath(`/categoria/[slug]`, 'page');
    revalidatePath(`/produto/${existingProduct.slug}`);
    if (input.slug && input.slug !== existingProduct.slug) {
      revalidatePath(`/produto/${input.slug}`);
    }

    const fullProduct = await prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { position: 'asc' } },
        variants: {
          include: { inventory: true },
          orderBy: { position: 'asc' },
        },
        categories: { include: { category: true } },
        collections: { include: { collection: true } },
      },
    });

    return NextResponse.json({ success: true, product: fullProduct });
  } catch (error) {
    console.error('Error updating product:', error);
    if (error instanceof InvalidProductVariantError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar produto.' },
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
    const existing = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: { select: { id: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado.' },
        { status: 404 }
      );
    }

    const variantIds = existing.variants.map((variant) => variant.id);
    const hasOrderHistory = variantIds.length > 0 && (
      await prisma.orderItem.count({ where: { variantId: { in: variantIds } } })
    ) > 0;

    if (hasOrderHistory) {
      await prisma.product.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });
    } else {
      await prisma.$transaction(async (transaction) => {
        await transaction.productImage.deleteMany({ where: { productId: id } });
        await transaction.productCategory.deleteMany({ where: { productId: id } });
        await transaction.collectionProduct.deleteMany({ where: { productId: id } });
        await transaction.review.deleteMany({ where: { productId: id } });
        if (variantIds.length > 0) {
          const inventories = await transaction.inventory.findMany({
            where: { variantId: { in: variantIds } },
            select: { id: true },
          });
          await transaction.inventoryMovement.deleteMany({
            where: { inventoryId: { in: inventories.map((inventory) => inventory.id) } },
          });
          await transaction.inventory.deleteMany({ where: { variantId: { in: variantIds } } });
          await transaction.cartItem.deleteMany({ where: { variantId: { in: variantIds } } });
          await transaction.wishlistItem.deleteMany({ where: { variantId: { in: variantIds } } });
        }
        await transaction.productVariant.deleteMany({ where: { productId: id } });
        await transaction.product.delete({ where: { id } });
      });
    }

    revalidatePath('/');
    revalidatePath('/colecoes');
    revalidatePath('/categoria/[slug]', 'page');
    revalidatePath(`/produto/${existing.slug}`);

    return NextResponse.json({
      success: true,
      message: hasOrderHistory
        ? 'Produto arquivado para preservar o histórico de pedidos.'
        : 'Produto excluído com sucesso.',
    });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao excluir produto.' },
      { status: 500 }
    );
  }
}
