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

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const categories = await prisma.category.findMany({
      where,
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { position: 'asc' },
    });

    return NextResponse.json({ success: true, categories });
  } catch (error: any) {
    console.error('Error listing categories:', error);
    return NextResponse.json(
      { success: false, error: 'Falha ao buscar categorias.' },
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
      description,
      imageUrl,
      iconName = 'Layers',
      position = 0,
      isActive = true,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'O nome da categoria é obrigatório.' },
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

    // Check duplicate
    const existing = await prisma.category.findUnique({
      where: { slug: finalSlug },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `A categoria com slug "${finalSlug}" já existe.` },
        { status: 400 }
      );
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        slug: finalSlug,
        description: description || null,
        imageUrl: imageUrl || null,
        iconName: iconName || 'Layers',
        position: Number(position) || 0,
        isActive: Boolean(isActive),
      },
      include: {
        _count: { select: { products: true } },
      },
    });

    revalidatePath('/');
    revalidatePath(`/categoria/${finalSlug}`);

    return NextResponse.json({ success: true, category }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao criar categoria.' },
      { status: 500 }
    );
  }
}
