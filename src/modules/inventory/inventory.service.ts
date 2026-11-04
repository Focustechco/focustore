export class InventoryService {
  static async reserveStock(
    tx: any,
    items: { variantId: string; quantity: number }[],
    referenceId: string
  ) {
    // Lock inventory rows in a deterministic order and reserve with a guarded UPDATE.
    // This prevents two concurrent checkouts from both reserving the same units.
    for (const item of [...items].sort((a, b) => a.variantId.localeCompare(b.variantId))) {
      const inventory = await tx.inventory.findUnique({
        where: { variantId: item.variantId },
      });

      if (!inventory) {
        throw new Error(`Estoque não cadastrado para a variante ${item.variantId}`);
      }

      const updated = await tx.inventory.updateMany({
        where: {
          id: inventory.id,
          quantityAvailable: { gte: item.quantity },
        },
        data: {
          quantityAvailable: { decrement: item.quantity },
          quantityReserved: { increment: item.quantity },
        },
      });

      if (updated.count !== 1) {
        throw new Error('Estoque insuficiente para concluir a reserva.');
      }

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
