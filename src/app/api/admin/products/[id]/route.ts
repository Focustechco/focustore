import { InputError } from '@/lib/security/input-error';
import { validateProductInput, validatePromotionalPrice } from '@/modules/catalog/product-validation';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { revalidatePath } from 'next/cache';

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
    const body = validateProductInput(await request.json(), true);

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

    const result = await prisma.$transaction(async (tx) => {
      const existingProduct = await tx.product.findUnique({
        where: { id },
      });

      if (!existingProduct) throw new InputError('Produto não encontrado.', 404);
      validatePromotionalPrice(basePrice ?? existingProduct.basePrice,
                               promotionalPrice === undefined ? existingProduct.promotionalPrice : promotionalPrice);
      const variantIds = (variants ?? []).flatMap(v => v.id ? [v.id] : []);
      const owned = await tx.productVariant.count({ where: { id: { in: variantIds }, productId: id } });
      if (owned !== variantIds.length) throw new InputError('Variante não pertence a este produto.');
      for (const v of variants ?? []) validatePromotionalPrice(v.price ?? basePrice ?? existingProduct.basePrice, v.promotionalPrice);

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
      const updatedProduct = await tx.product.update({
        where: { id },
        data: dataToUpdate,
      });

      // 2. Sync Categories if provided
      if (Array.isArray(categoryIds)) {
        await tx.productCategory.deleteMany({ where: { productId: id } });
        if (categoryIds.length > 0) {
          await tx.productCategory.createMany({
            data: categoryIds.map((catId: string) => ({
              productId: id,
              categoryId: catId,
            })),
          });
        }
      }

      // 3. Sync Collections if provided
      if (Array.isArray(collectionIds)) {
        await tx.collectionProduct.deleteMany({ where: { productId: id } });
        if (collectionIds.length > 0) {
          await tx.collectionProduct.createMany({
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
        await tx.productImage.deleteMany({ where: { productId: id } });
        if (images.length > 0) {
          await tx.productImage.createMany({
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
            const previousVariant = await tx.productVariant.findUniqueOrThrow({ where: { id: v.id, productId: id } });
            validatePromotionalPrice(v.price ?? basePrice ?? previousVariant.price,
              v.promotionalPrice === undefined ? previousVariant.promotionalPrice : v.promotionalPrice);
            // Update existing variant
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                name: v.name,
                sku: v.sku,
                color: v.color === undefined ? previousVariant.color : v.color || null,
                colorHex: v.colorHex === undefined ? previousVariant.colorHex : v.colorHex || null,
                size: v.size === undefined ? previousVariant.size : v.size || null,
                price: Number(v.price ?? basePrice ?? previousVariant.price),
                promotionalPrice: v.promotionalPrice === undefined ? previousVariant.promotionalPrice : v.promotionalPrice,
                imageUrl: v.imageUrl === undefined ? previousVariant.imageUrl : v.imageUrl,
                isActive: v.isActive ?? previousVariant.isActive,
                position: i,
              },
            });

            // Update inventory stock
            if (v.stock !== undefined || v.quantityAvailable !== undefined) {
              const stockQty = Number(v.stock ?? v.quantityAvailable);
              const inv = await tx.inventory.findUnique({ where: { variantId: v.id } });
              if (inv) {
                await tx.inventory.update({
                  where: { id: inv.id },
                  data: { quantityAvailable: stockQty },
                });
              } else {
                await tx.inventory.create({
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
            const newVar = await tx.productVariant.create({
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

            await tx.inventory.create({
              data: {
                variantId: newVar.id,
                quantityAvailable: Number(v.stock ?? v.quantityAvailable ?? 0),
                quantityReserved: 0,
              },
            });
          }
        }
      }

      const fullProduct = await tx.product.findUnique({
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


      return { product: fullProduct, previousSlug: existingProduct.slug };
    });
    const fullProduct = result.product;
    // Comprehensive store revalidation
    revalidatePath('/');
    revalidatePath('/colecoes');
    revalidatePath(`/colecao/[slug]`, 'page');
    revalidatePath(`/categoria/[slug]`, 'page');
    revalidatePath(`/produto/${result.previousSlug}`);
    if (slug && slug !== result.previousSlug) {
      revalidatePath(`/produto/${slug}`);
    }

    return NextResponse.json({ success: true, product: fullProduct });
  } catch (error: any) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
    if (error?.code === 'P2002') return NextResponse.json({ error: 'SKU ou slug já cadastrado.' }, { status: 409 });
    console.error('Error updating product:');
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
      include: { variants: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Produto não encontrado.' },
        { status: 404 }
      );
    }

    // Preserve order history, inventories and all related records.
    await prisma.product.update({ where: { id }, data: { status: 'ARCHIVED' } });

    revalidatePath('/');
    revalidatePath('/colecoes');
    revalidatePath('/categoria/[slug]', 'page');
    revalidatePath(`/produto/${existing.slug}`);

    return NextResponse.json({
      success: true,
      message: 'Produto excluído com sucesso.',
    });
  } catch (error: any) {
    console.error('Error deleting product:');
    return NextResponse.json(
      { success: false, error: 'Erro ao excluir produto.' },
      { status: 500 }
    );
  }
}
