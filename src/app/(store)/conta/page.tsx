import React from 'react';
import Link from 'next/link';
import { Package, Heart, MapPin, User, ChevronRight } from 'lucide-react';
import { OrderService } from '@/modules/orders/order.service';
import { formatPrice, formatDate } from '@/lib/utils/formatters';

export default async function CustomerAccountPage() {
  // Usuário padrão de demonstração cliente@focusstore.com
  const userOrders = await OrderService.getOrdersByUserId('mock-customer-id');
  const recentOrders = userOrders.slice(0, 3);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="border-b border-white/10 pb-4">
        <span className="text-xs font-bold text-focus uppercase tracking-widest">Área do Cliente</span>
        <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Minha Conta
        </h1>
      </div>

      {/* Cards de Navegação da Conta */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/conta/pedidos"
          className="p-5 rounded-2xl bg-surface border border-white/10 hover:border-focus transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-focus/15 text-focus flex items-center justify-center">
              <Package size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-focus transition-colors">Meus Pedidos</h3>
              <p className="text-xs text-muted">Histórico e rastreamento</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-muted group-hover:text-white" />
        </Link>

        <Link
          href="/conta/favoritos"
          className="p-5 rounded-2xl bg-surface border border-white/10 hover:border-focus transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-focus/15 text-focus flex items-center justify-center">
              <Heart size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-focus transition-colors">Favoritos</h3>
              <p className="text-xs text-muted">Lista de desejos</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-muted group-hover:text-white" />
        </Link>

        <Link
          href="/conta/enderecos"
          className="p-5 rounded-2xl bg-surface border border-white/10 hover:border-focus transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-focus/15 text-focus flex items-center justify-center">
              <MapPin size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-focus transition-colors">Endereços</h3>
              <p className="text-xs text-muted">Locais de entrega salvos</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-muted group-hover:text-white" />
        </Link>
      </div>

      {/* Últimos Pedidos */}
      <div className="bg-surface p-6 rounded-2xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Últimos Pedidos</h2>
          <Link href="/conta/pedidos" className="text-xs font-semibold text-focus hover:underline">
            Ver todos →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted">
            Você ainda não realizou pedidos na Focus Store.
          </div>
        ) : (
          <div className="divide-y divide-white/5 space-y-3">
            {recentOrders.map((ord) => (
              <div key={ord.id} className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-white">{ord.orderNumber}</p>
                  <p className="text-muted">{formatDate(ord.createdAt)} • {ord.items.length} itens</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="px-2.5 py-1 rounded bg-focus/15 text-focus font-bold uppercase text-[10px]">
                    {ord.status}
                  </span>
                  <span className="font-bold text-white">{formatPrice(ord.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}