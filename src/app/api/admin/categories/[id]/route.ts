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
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        products: {
          include: {
            product: {
              include: {
                images: { orderBy: { position: 'asc' }, take: 1 },
              },
            },
          },
        },
        _count: { select: { products: true } },
      },
    });

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Categoria não encontrada.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, category });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar categoria.' },
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
      name,
      slug,
      description,
      imageUrl,
      iconName,
      position,
      isActive,
    } = body;

    const existing = await prisma.category.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Categoria não encontrada.' },
        { status: 404 }
      );
    }

    const dataToUpdate: any = {};
    if (name !== undefined) dataToUpdate.name = name.trim();
    if (slug !== undefined) {
      const finalSlug = slug.trim().toLowerCase();
      if (finalSlug !== existing.slug) {
        const slugExists = await prisma.category.findUnique({
          where: { slug: finalSlug },
        });
        if (slugExists) {
          return NextResponse.json(
            { success: false, error: `O slug "${finalSlug}" já está em uso.` },
            { status: 400 }
          );
        }
      }
      dataToUpdate.slug = finalSlug;
    }
    if (description !== undefined) dataToUpdate.description = description || null;
    if (imageUrl !== undefined) dataToUpdate.imageUrl = imageUrl || null;
    if (iconName !== undefined) dataToUpdate.iconName = iconName || 'Layers';
    if (position !== undefined) dataToUpdate.position = Number(position);
    if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive);

    const updated = await prisma.category.update({
      where: { id },
      data: dataToUpdate,
      include: {
        _count: { select: { products: true } },
      },
    });

    revalidatePath('/');
    revalidatePath(`/categoria/${existing.slug}`);
    if (slug && slug !== existing.slug) {
      revalidatePath(`/categoria/${slug}`);
    }

    return NextResponse.json({ success: true, category: updated });
  } catch (error: any) {
    console.error('Error updating category:');
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar categoria.' },
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
    const existing = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Categoria não encontrada.' },
        { status: 404 }
      );
    }

    // Delete relationships from ProductCategory
    await prisma.category.update({ where: { id }, data: { isActive: false } });

    revalidatePath('/');
    revalidatePath(`/categoria/${existing.slug}`);

    return NextResponse.json({
      success: true,
      message: 'Categoria excluída com sucesso.',
    });
  } catch (error: any) {
    console.error('Error deleting category:');
    return NextResponse.json(
      { success: false, error: 'Erro ao excluir categoria.' },
      { status: 500 }
    );
  }
}
