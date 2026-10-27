import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';
import { revalidatePath } from 'next/cache';

export async function GET(request: Request) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.authorized) return authorization.response;

    const { searchParams } = new URL(request.url);
    const placement = searchParams.get('placement') || undefined;

    const banners = await prisma.banner.findMany({
      where: placement ? { placement } : undefined,
      orderBy: { position: 'asc' },
    });

    return NextResponse.json({ success: true, banners });
  } catch (error: any) {
    console.error('Error fetching banners:');
    return NextResponse.json(
      { success: false, error: 'Falha ao buscar banners.' },
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
      title,
      subtitle,
      ctaText,
      ctaLink,
      imageUrl,
      position = 0,
      placement = 'home_hero',
      isActive = true,
    } = body;

    if (!title || !imageUrl) {
      return NextResponse.json(
        { success: false, error: 'Título e imagem são obrigatórios.' },
        { status: 400 }
      );
    }

    const banner = await prisma.banner.create({
      data: {
        title,
        subtitle: subtitle || null,
        ctaText: ctaText || null,
        ctaLink: ctaLink || null,
        imageUrl,
        position: Number(position) || 0,
        placement: placement || 'home_hero',
        isActive: Boolean(isActive),
      },
    });

    // Revalidate store homepage and any other public page
    revalidatePath('/');

    return NextResponse.json({ success: true, banner }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating banner:');
    return NextResponse.json(
      { success: false, error: 'Erro ao criar banner.' },
      { status: 500 }
    );
  }
}
