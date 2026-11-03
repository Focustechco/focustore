import { prisma } from '@/lib/db/prisma';

export class InventoryService {
  static async reserveStock(
    tx: any,
    items: { variantId: string; quantity: number }[],
    referenceId: string
  ) {
    for (const item of items) {
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

      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          quantityAvailable: { decrement: item.quantity },
          quantityReserved: { increment: item.quantity },
        },
      });

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

  static async commitStock(tx: any, orderId: string) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) return;

    for (const item of order.items) {
      const inventory = await tx.inventory.findUnique({
        where: { variantId: item.variantId },
      });

      if (!inventory) continue;

      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          quantityReserved: { decrement: item.quantity },
        },
      });

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

  static async releaseStock(tx: any, orderId: string) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) return;

    for (const item of order.items) {
      const inventory = await tx.inventory.findUnique({
        where: { variantId: item.variantId },
      });

      if (!inventory) continue;

      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          quantityAvailable: { increment: item.quantity },
          quantityReserved: { decrement: item.quantity },
        },
      });

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