import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { revalidatePath } from 'next/cache';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const { id } = await params;
    const body = await request.json();

    const {
      name,
      slug,
      sku,
      description,
      shortDescription,
      brand,
      basePrice,
      promotionalPrice,
      costPrice,
      status,
      isFeatured,
      weightGrams,
      heightCm,
      widthCm,
      lengthCm,
      categoryIds,
      collectionIds,
      images,
      variants,
    } = body;

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado.' },
        { status: 404 }
      );
    }

    const dataToUpdate: any = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (slug !== undefined) dataToUpdate.slug = slug;
    if (sku !== undefined) dataToUpdate.sku = sku;
    if (description !== undefined) dataToUpdate.description = description;
    if (shortDescription !== undefined) dataToUpdate.shortDescription = shortDescription;
    if (brand !== undefined) dataToUpdate.brand = brand;
    if (basePrice !== undefined) dataToUpdate.basePrice = Number(basePrice);
    if (promotionalPrice !== undefined)
      dataToUpdate.promotionalPrice = promotionalPrice ? Number(promotionalPrice) : null;
    if (costPrice !== undefined)
      dataToUpdate.costPrice = costPrice ? Number(costPrice) : null;
    if (status !== undefined) dataToUpdate.status = status;
    if (isFeatured !== undefined) dataToUpdate.isFeatured = Boolean(isFeatured);
    if (weightGrams !== undefined) dataToUpdate.weightGrams = Number(weightGrams);
    if (heightCm !== undefined) dataToUpdate.heightCm = Number(heightCm);
    if (widthCm !== undefined) dataToUpdate.widthCm = Number(widthCm);
    if (lengthCm !== undefined) dataToUpdate.lengthCm = Number(lengthCm);

    // 1. Update product base info
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: dataToUpdate,
    });

    // 2. Sync Categories if provided
    if (Array.isArray(categoryIds)) {
      await prisma.productCategory.deleteMany({ where: { productId: id } });
      if (categoryIds.length > 0) {
        await prisma.productCategory.createMany({
          data: categoryIds.map((catId: string) => ({
            productId: id,
            categoryId: catId,
          })),
        });
      }
    }

    // 3. Sync Collections if provided
    if (Array.isArray(collectionIds)) {
      await prisma.collectionProduct.deleteMany({ where: { productId: id } });
      if (collectionIds.length > 0) {
        await prisma.collectionProduct.createMany({
          data: collectionIds.map((colId: string, idx: number) => ({
            productId: id,
            collectionId: colId,
            position: idx,
          })),
        });
      }
    }

    // 4. Sync Images if provided
    if (Array.isArray(images)) {
      await prisma.productImage.deleteMany({ where: { productId: id } });
      if (images.length > 0) {
        await prisma.productImage.createMany({
          data: images.map((img: any, idx: number) => ({
            productId: id,
            url: typeof img === 'string' ? img : img.url,
            altText: typeof img === 'object' ? img.altText : (name || existingProduct.name),
            position: idx,
            isPrimary: idx === 0,
          })),
        });
      }
    }

    // 5. Sync / Update Variants & Inventory if provided
    if (Array.isArray(variants)) {
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        if (v.id) {
          // Update existing variant
          await prisma.productVariant.update({
            where: { id: v.id },
            data: {
              name: v.name,
              sku: v.sku,
              color: v.color || null,
              colorHex: v.colorHex || null,
              size: v.size || null,
              price: Number(v.price ?? basePrice ?? existingProduct.basePrice),
              promotionalPrice: v.promotionalPrice ? Number(v.promotionalPrice) : null,
              imageUrl: v.imageUrl || null,
              isActive: v.isActive !== undefined ? Boolean(v.isActive) : true,
              position: i,
            },
          });

          // Update inventory stock
          if (v.stock !== undefined || v.quantityAvailable !== undefined) {
            const stockQty = Number(v.stock ?? v.quantityAvailable);
            const inv = await prisma.inventory.findUnique({ where: { variantId: v.id } });
            if (inv) {
              await prisma.inventory.update({
                where: { id: inv.id },
                data: { quantityAvailable: stockQty },
              });
            } else {
              await prisma.inventory.create({
                data: {
                  variantId: v.id,
                  quantityAvailable: stockQty,
                  quantityReserved: 0,
                },
              });
            }
          }
        } else {
          // Create new variant
          const variantSku = v.sku || `${existingProduct.sku}-${v.color || 'VAR'}-${v.size || i + 1}`;
          const newVar = await prisma.productVariant.create({
            data: {
              productId: id,
              sku: variantSku,
              name: v.name || `${updatedProduct.name} - ${v.color || ''} ${v.size || ''}`.trim(),
              color: v.color || null,
              colorHex: v.colorHex || null,
              size: v.size || null,
              price: Number(v.price ?? basePrice ?? existingProduct.basePrice),
              promotionalPrice: v.promotionalPrice ? Number(v.promotionalPrice) : null,
              imageUrl: v.imageUrl || null,
              position: i,
              isActive: v.isActive !== undefined ? Boolean(v.isActive) : true,
            },
          });

          await prisma.inventory.create({
            data: {
              variantId: newVar.id,
              quantityAvailable: Number(v.stock ?? v.quantityAvailable ?? 50),
              quantityReserved: 0,
            },
          });
        }
      }
    }

    // Comprehensive store revalidation
    revalidatePath('/');
    revalidatePath('/colecoes');
    revalidatePath(`/colecao/[slug]`, 'page');
    revalidatePath(`/categoria/[slug]`, 'page');
    revalidatePath(`/produto/${existingProduct.slug}`);
    if (slug && slug !== existingProduct.slug) {
      revalidatePath(`/produto/${slug}`);
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
  } catch (error: any) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao atualizar produto.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await prisma.product.findUnique({
      where: { id },
      include: { variants: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado.' },
        { status: 404 }
      );
    }

    // Clean up dependent tables
    await prisma.productImage.deleteMany({ where: { productId: id } });
    await prisma.productCategory.deleteMany({ where: { productId: id } });
    await prisma.collectionProduct.deleteMany({ where: { productId: id } });
    await prisma.review.deleteMany({ where: { productId: id } });

    for (const v of existing.variants) {
      await prisma.inventory.deleteMany({ where: { variantId: v.id } });
      await prisma.cartItem.deleteMany({ where: { variantId: v.id } });
      await prisma.orderItem.deleteMany({ where: { variantId: v.id } });
      await prisma.wishlistItem.deleteMany({ where: { variantId: v.id } });
    }

    await prisma.productVariant.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });

    revalidatePath('/');
    revalidatePath('/colecoes');
    revalidatePath('/categoria/[slug]', 'page');
    revalidatePath(`/produto/${existing.slug}`);

    return NextResponse.json({
      success: true,
      message: 'Produto excluído com sucesso.',
    });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao excluir produto.' },
      { status: 500 }
    );
  }
}
