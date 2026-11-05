'use client';

import { useState } from 'react';
import { ORDER_STATUSES, type OrderStatus } from '@/modules/orders/order-status';

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pendente',
  PAYMENT_PENDING: 'Pagamento pendente',
  PAID: 'Pago',
  PROCESSING: 'Em preparação',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
  REFUNDED: 'Reembolsado',
};

export function OrderStatusControl({
  orderId,
  initialStatus,
}: {
  orderId: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const knownStatus = ORDER_STATUSES.find((candidate) => candidate === status);

  async function saveStatus() {
    setError('');
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: selectedStatus }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Não foi possível atualizar o pedido.');
      }

      setStatus(result.status);
      setSelectedStatus(result.status);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha de comunicação.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex min-w-48 flex-col gap-2">
      <span className="px-2 py-0.5 rounded bg-focus/15 text-focus font-bold uppercase text-[10px] w-fit">
        {knownStatus ? STATUS_LABELS[knownStatus] : status}
      </span>
      <div className="flex items-center gap-2">
        <select
          aria-label="Novo status do pedido"
          className="min-w-0 rounded border border-white/10 bg-[#101010] px-2 py-1 text-[10px] text-white"
          value={selectedStatus}
          onChange={(event) => setSelectedStatus(event.target.value)}
        >
          {ORDER_STATUSES.map((value) => (
            <option key={value} value={value}>{STATUS_LABELS[value]}</option>
          ))}
        </select>
        <button
          type="button"
          className="rounded bg-white/10 px-2 py-1 text-[10px] font-semibold disabled:opacity-40"
          disabled={isSaving || selectedStatus === status}
          onClick={saveStatus}
        >
          {isSaving ? 'Salvando' : 'Atualizar'}
        </button>
      </div>
      {error && <span role="alert" className="text-[10px] text-red-400">{error}</span>}
    </div>
  );
}
