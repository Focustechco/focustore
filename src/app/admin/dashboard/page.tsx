import React from 'react';
import Link from 'next/link';
import {
  DollarSign,
  ShoppingBag,
  Users,
  Package,
  TrendingUp,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { AdminService } from '@/modules/admin/admin.service';
import { formatPrice, formatDate } from '@/lib/utils/formatters';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const stats = await AdminService.getDashboardStats();

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* Topo do Dashboard */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
            Dashboard Geral
          </h1>
        </div>
        <div className="text-xs text-muted">
          Atualizado em tempo real • PostgreSQL
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Faturamento */}
        <div className="p-5 rounded-2xl bg-surface border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Faturamento Total</span>
            <div className="p-2 rounded-lg bg-focus/10 text-focus">
              <DollarSign size={18} />
            </div>
          </div>
          <p className="text-2xl font-black text-white tracking-tight">
            {formatPrice(stats.totalRevenue)}
          </p>
          <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
            <TrendingUp size={12} /> {stats.paidOrders} pedidos pagos
          </p>
        </div>

        {/* Total Pedidos */}
        <div className="p-5 rounded-2xl bg-surface border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Total Pedidos</span>
            <div className="p-2 rounded-lg bg-surface-hover text-white">
              <ShoppingBag size={18} />
            </div>
          </div>
          <p className="text-2xl font-black text-white tracking-tight">
            {stats.totalOrders}
          </p>
          <p className="text-[11px] text-muted font-medium">
            Todos os status combinados
          </p>
        </div>

        {/* Ticket Médio */}
        <div className="p-5 rounded-2xl bg-surface border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Ticket Médio</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp size={18} />
            </div>
          </div>
          <p className="text-2xl font-black text-white tracking-tight">
            {formatPrice(stats.averageTicket)}
          </p>
          <p className="text-[11px] text-muted font-medium">
            Por pedido confirmado
          </p>
        </div>

        {/* Clientes */}
        <div className="p-5 rounded-2xl bg-surface border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Clientes Cadastrados</span>
            <div className="p-2 rounded-lg bg-surface-hover text-white">
              <Users size={18} />
            </div>
          </div>
          <p className="text-2xl font-black text-white tracking-tight">
            {stats.totalCustomers}
          </p>
          <p className="text-[11px] text-muted font-medium">
            {stats.productsCount} produtos no catálogo
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Pedidos Recentes (7 Cols) */}
        <div className="lg:col-span-7 bg-surface p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Pedidos Recentes
            </h2>
            <Link href="/admin/pedidos" className="text-xs text-focus hover:underline font-semibold">
              Ver todos →
            </Link>
          </div>

          <div className="divide-y divide-white/5 space-y-3">
            {stats.recentOrders.map((ord) => (
              <div key={ord.id} className="pt-3 flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold text-white">{ord.orderNumber}</p>
                  <p className="text-muted">{formatDate(ord.createdAt)} • {ord.items.length} itens</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-white">{formatPrice(ord.total)}</p>
                  <span className="inline-block px-2 py-0.5 rounded bg-focus/15 text-focus font-bold uppercase text-[10px] mt-0.5">
                    {ord.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerta de Estoque Baixo (5 Cols) */}
        <div className="lg:col-span-5 bg-surface p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-400" />
              Estoque Baixo / Crítico
            </h2>
            <Link href="/admin/estoque" className="text-xs text-focus hover:underline font-semibold">
              Gerenciar →
            </Link>
          </div>

          <div className="divide-y divide-white/5 space-y-3">
            {stats.lowStockVariants.length === 0 ? (
              <p className="text-xs text-muted py-4 text-center">Nenhum produto com estoque crítico.</p>
            ) : (
              stats.lowStockVariants.map((v) => (
                <div key={v.id} className="pt-3 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-white">{v.product.name}</p>
                    <p className="text-muted">{v.name} ({v.sku})</p>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-red-500/15 text-red-400 font-bold">
                    {v.inventory?.quantityAvailable || 0} un.
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}