import React from 'react';
import Link from 'next/link';
import { ChevronRight, Package } from 'lucide-react';
import { prisma } from '@/lib/db/prisma';
import { formatPrice, formatDate } from '@/lib/utils/formatters';
import { getAuthenticatedUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function CustomerOrdersPage() {
  const customer = await getAuthenticatedUser();
  const orders = customer
    ? await prisma.order.findMany({
        where: { userId: customer.id },
        include: { items: true, payments: true, shipments: true },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <nav className="flex items-center gap-2 text-xs text-muted uppercase tracking-wider">
        <Link href="/" className="hover:text-white">Início</Link>
        <ChevronRight size={14} />
        <Link href="/conta" className="hover:text-white">Minha Conta</Link>
        <ChevronRight size={14} />
        <span className="text-white font-semibold">Meus Pedidos</span>
      </nav>

      <div className="border-b border-white/10 pb-4">
        <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Histórico de Pedidos
        </h1>
        {!customer && (
          <p className="mt-2 text-sm text-muted">
            Entre na sua conta para consultar seu histórico de pedidos.
          </p>
        )}
      </div>

      <div className="space-y-4">
        {orders.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-surface border border-white/10 text-muted text-sm">
            {customer
              ? 'Nenhum pedido encontrado no momento.'
              : 'Faça login para ver seus pedidos.'}
          </div>
        ) : (
          orders.map((ord) => (
            <div key={ord.id} className="p-6 rounded-2xl bg-surface border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                <div>
                  <span className="text-xs font-bold text-focus uppercase tracking-wider block">
                    Pedido #{ord.orderNumber}
                  </span>
                  <span className="text-xs text-muted">{formatDate(ord.createdAt)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10 text-white font-bold uppercase text-[11px]">
                    Status: {ord.status}
                  </span>
                  <span className="text-sm font-bold text-focus">{formatPrice(ord.total)}</span>
                </div>
              </div>

              <div className="divide-y divide-white/5 space-y-2">
                {ord.items?.map((it: any) => (
                  <div key={it.id} className="pt-2 flex justify-between text-xs text-muted">
                    <span>{it.productName} ({it.variantName}) x{it.quantity}</span>
                    <span className="text-white font-medium">{formatPrice(it.totalPrice)}</span>
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-muted pt-2 border-t border-white/5 flex justify-between">
                <span>Entrega: {ord.shippingStreet}, {ord.shippingNumber} - {ord.shippingCity}/{ord.shippingState}</span>
                {ord.shipments?.[0]?.trackingCode && (
                  <span className="text-focus font-bold">Rastreio: {ord.shipments[0].trackingCode}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}