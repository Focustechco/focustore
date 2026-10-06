import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { revalidatePath } from 'next/cache';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const banner = await prisma.banner.findUnique({
      where: { id },
    });

    if (!banner) {
      return NextResponse.json(
        { success: false, error: 'Banner não encontrado.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, banner });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar banner.' },
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
      title,
      subtitle,
      ctaText,
      ctaLink,
      imageUrl,
      position,
      placement,
      isActive,
    } = body;

    const dataToUpdate: any = {};
    if (title !== undefined) dataToUpdate.title = title;
    if (subtitle !== undefined) dataToUpdate.subtitle = subtitle;
    if (ctaText !== undefined) dataToUpdate.ctaText = ctaText;
    if (ctaLink !== undefined) dataToUpdate.ctaLink = ctaLink;
    if (imageUrl !== undefined) dataToUpdate.imageUrl = imageUrl;
    if (position !== undefined) dataToUpdate.position = Number(position);
    if (placement !== undefined) dataToUpdate.placement = placement;
    if (isActive !== undefined) dataToUpdate.isActive = Boolean(isActive);

    const banner = await prisma.banner.update({
      where: { id },
      data: dataToUpdate,
    });

    // Instant revalidation
    revalidatePath('/');

    return NextResponse.json({ success: true, banner });
  } catch (error: any) {
    console.error('Error updating banner:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao atualizar banner.' },
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
    await prisma.banner.delete({
      where: { id },
    });

    revalidatePath('/');

    return NextResponse.json({
      success: true,
      message: 'Banner excluído com sucesso.',
    });
  } catch (error: any) {
    console.error('Error deleting banner:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao excluir banner.' },
      { status: 500 }
    );
  }
}
