import React from 'react';
import { prisma } from '@/lib/db/prisma';
import { formatPrice, formatDate } from '@/lib/utils/formatters';
import { OrderStatusControl } from '@/components/admin/order-status-control';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    include: { items: true, payments: true, shipments: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="border-b border-white/10 pb-4">
        <h1 className="text-2xl font-black text-white uppercase tracking-tight">
          Gestão de Pedidos ({orders.length})
        </h1>
      </div>

      <div className="bg-surface rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#101010] text-muted uppercase tracking-wider font-semibold border-b border-white/10">
              <tr>
                <th className="p-4">Número</th>
                <th className="p-4">Data</th>
                <th className="p-4">Itens</th>
                <th className="p-4">Total</th>
                <th className="p-4">Pagamento</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted">
                    Nenhum pedido encontrado.
                  </td>
                </tr>
              ) : (
                orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-bold text-focus">{ord.orderNumber}</td>
                    <td className="p-4 text-muted">{formatDate(ord.createdAt)}</td>
                    <td className="p-4 text-muted">{ord.items?.length || 0} itens</td>
                    <td className="p-4 font-bold">{formatPrice(ord.total)}</td>
                    <td className="p-4 text-muted">{ord.payments?.[0]?.method || 'PIX'}</td>
                    <td className="p-4">
                      <OrderStatusControl orderId={ord.id} initialStatus={ord.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}