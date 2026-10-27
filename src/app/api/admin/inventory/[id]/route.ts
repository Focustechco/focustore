import { z } from 'zod';
import { InputError } from '@/lib/security/input-error';
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
    const parsed = z.object({
      quantityAvailable: z.number().int().min(0).max(2147483647).optional(),
      quantityChange: z.number().int().min(-2147483647).max(2147483647).optional(),
      movementType: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'RETURN']).optional(),
      reason: z.string().max(500).optional(),
      lowStockThreshold: z.number().int().min(0).max(2147483647).optional(),
    }).safeParse(await request.json());
    if (!parsed.success) throw new InputError('Ajuste de estoque invalido.');
    const body = parsed.data;
    const {
      quantityAvailable,
      quantityChange,
      movementType = 'ADJUSTMENT', // IN | OUT | ADJUSTMENT | RETURN
      reason = 'Ajuste manual via Painel Administrativo',
      lowStockThreshold,
    } = body;

    const result = await prisma.$transaction(async (tx) => {
      // Find inventory by variantId or inventory id
      let inventory = await tx.inventory.findFirst({
        where: { OR: [{ id }, { variantId: id }] },
        include: { variant: { include: { product: true } } },
      });

      if (!inventory) {
        // Create inventory if not present
        const variant = await tx.productVariant.findUnique({ where: { id } });
        if (!variant) throw new InputError('Variante nao encontrada.', 404);

        inventory = await tx.inventory.create({
          data: {
            variantId: variant.id,
            quantityAvailable: 0,
            quantityReserved: 0,
            lowStockThreshold: Number(lowStockThreshold ?? 5),
          },
          include: { variant: { include: { product: true } } },
        });
      }

      const previousQty = inventory.quantityAvailable;
      let newQty = previousQty;

      if (quantityAvailable !== undefined) {
        newQty = quantityAvailable;
      } else if (quantityChange !== undefined) {
        newQty = previousQty + quantityChange;
      }

      if (!Number.isSafeInteger(newQty) || newQty < 0 || newQty > 2147483647) throw new InputError('Saldo invalido.');
      const diff = newQty - previousQty;

      // Update inventory record
      const updatedInventory = await tx.inventory.update({
        where: { id: inventory.id, quantityAvailable: previousQty },
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
        await tx.inventoryMovement.create({
          data: {
            inventoryId: inventory.id,
            type: movementType,
            quantity: Math.abs(diff),
            reason: `${reason} (${diff > 0 ? `+${diff}` : `${diff}`} un | Saldo: ${newQty})`,
          },
        });
      }

      return {
        success: true,
        inventory: updatedInventory,
        previousQuantity: previousQty,
        newQuantity: newQty,
      };

    });
    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error?.code === 'P2025') return NextResponse.json({ error: 'Estoque alterado. Tente novamente.' }, { status: 409 });
    console.error('Error updating inventory:');
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar estoque.' },
      { status: 500 }
    );
  }
}
