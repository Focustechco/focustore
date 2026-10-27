import type { Prisma } from '@prisma/client';
import { InputError } from '@/lib/security/input-error';

export class InventoryService {
  static async reserveStock(
    tx: Prisma.TransactionClient,
    items: { variantId: string; quantity: number }[],
    referenceId: string
  ) {
    for (const item of items) {
      if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) throw new InputError('Quantidade inválida.');
      const inventory = await tx.inventory.findUnique({
        where: { variantId: item.variantId },
      });

      if (!inventory) {
        throw new Error(`Estoque não cadastrado para a variante ${item.variantId}`);
      }

      if (inventory.quantityAvailable < item.quantity) {
        throw new Error(
          `Estoque insuficiente. Disponível: ${inventory.quantityAvailable}, Solicitado: ${item.quantity}`
        );
      }

      const updated = await tx.inventory.updateMany({
        where: { id: inventory.id, quantityAvailable: { gte: item.quantity } },
        data: {
          quantityAvailable: { decrement: item.quantity },
          quantityReserved: { increment: item.quantity },
        },
      });
      if (updated.count !== 1) throw new InputError('Estoque insuficiente.', 409);

      await tx.inventoryMovement.create({
        data: {
          inventoryId: inventory.id,
          type: 'RESERVE',
          quantity: item.quantity,
          reason: 'Reserva para checkout de pedido',
          referenceId,
        },
      });
    }
  }

  static async commitStock(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) return;

    for (const item of order.items) {
      const inventory = await tx.inventory.findUnique({
        where: { variantId: item.variantId },
      });

      if (!inventory) throw new InputError('Estoque não encontrado.', 409);

      const updated = await tx.inventory.updateMany({
        where: { id: inventory.id, quantityReserved: { gte: item.quantity } },
        data: {
          quantityReserved: { decrement: item.quantity },
        },
      });
      if (updated.count !== 1) throw new InputError('Reserva de estoque inconsistente.', 409);

      await tx.inventoryMovement.create({
        data: {
          inventoryId: inventory.id,
          type: 'OUT',
          quantity: item.quantity,
          reason: `Pagamento confirmado para pedido ${order.orderNumber}`,
          referenceId: orderId,
        },
      });
    }
  }

  static async releaseStock(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) return;

    for (const item of order.items) {
      const inventory = await tx.inventory.findUnique({
        where: { variantId: item.variantId },
      });

      if (!inventory) throw new InputError('Estoque não encontrado.', 409);

      const updated = await tx.inventory.updateMany({
        where: { id: inventory.id, quantityReserved: { gte: item.quantity } },
        data: {
          quantityAvailable: { increment: item.quantity },
          quantityReserved: { decrement: item.quantity },
        },
      });
      if (updated.count !== 1) throw new InputError('Reserva de estoque inconsistente.', 409);

      await tx.inventoryMovement.create({
        data: {
          inventoryId: inventory.id,
          type: 'RELEASE',
          quantity: item.quantity,
          reason: `Pedido cancelado/expirado ${order.orderNumber}`,
          referenceId: orderId,
        },
      });
    }
  }
}
