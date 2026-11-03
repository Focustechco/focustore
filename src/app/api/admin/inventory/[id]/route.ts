import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { prisma } from '@/lib/db/prisma';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.authorized) return authorization.response;

    const { id } = await params; // variantId or inventoryId
    const body = await request.json();
    const {
      quantityAvailable,
      quantityChange,
      movementType = 'ADJUSTMENT', // IN | OUT | ADJUSTMENT | RETURN
      reason = 'Ajuste manual via Painel Administrativo',
      lowStockThreshold,
    } = body;

    // Find inventory by variantId or inventory id
    let inventory = await prisma.inventory.findFirst({
      where: { OR: [{ id }, { variantId: id }] },
      include: { variant: { include: { product: true } } },
    });

    if (!inventory) {
      // Create inventory if not present
      const variant = await prisma.productVariant.findUnique({ where: { id } });
      if (!variant) {
        return NextResponse.json(
          { success: false, error: 'Variante não encontrada.' },
          { status: 404 }
        );
      }

      inventory = await prisma.inventory.create({
        data: {
          variantId: variant.id,
          quantityAvailable: Number(quantityAvailable ?? 0),
          quantityReserved: 0,
          lowStockThreshold: Number(lowStockThreshold ?? 5),
        },
        include: { variant: { include: { product: true } } },
      });
    }

    const previousQty = inventory.quantityAvailable;
    let newQty = previousQty;

    if (quantityAvailable !== undefined) {
      newQty = Math.max(0, Number(quantityAvailable));
    } else if (quantityChange !== undefined) {
      newQty = Math.max(0, previousQty + Number(quantityChange));
    }

    const diff = newQty - previousQty;

    // Update inventory record
    const updatedInventory = await prisma.inventory.update({
      where: { id: inventory.id },
      data: {
        quantityAvailable: newQty,
        ...(lowStockThreshold !== undefined
          ? { lowStockThreshold: Number(lowStockThreshold) }
          : {}),
      },
      include: {
        variant: { include: { product: true } },
        movements: { take: 5, orderBy: { createdAt: 'desc' } },
      },
    });

    // Create movement log entry if quantity changed
    if (diff !== 0) {
      await prisma.inventoryMovement.create({
        data: {
          inventoryId: inventory.id,
          type: movementType,
          quantity: Math.abs(diff),
          reason: `${reason} (${diff > 0 ? `+${diff}` : `${diff}`} un | Saldo: ${newQty})`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      inventory: updatedInventory,
      previousQuantity: previousQty,
      newQuantity: newQty,
    });
  } catch (error: any) {
    console.error('Error updating inventory:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao atualizar estoque.' },
      { status: 500 }
    );
  }
}
