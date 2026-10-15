import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { OrderService } from '@/modules/orders/order.service';
import { formatPrice, formatDate } from '@/lib/utils/formatters';
import { Button } from '@/components/ui/button';
import { OrderConfirmationClient } from './order-confirmation-client';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

interface Props {
  params: Promise<{ orderId: string }>;
}

export default async function OrderConfirmationPage({ params }: Props) {
  const { orderId } = await params;
  const order = await OrderService.getOrderById(orderId);

  if (!order) {
    notFound();
  }

  const payment = order.payments[0];
  const isPix = payment?.method === 'PIX';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      {/* Header do Pedido */}
      <div className="text-center space-y-2">
        <span className="text-xs font-bold text-[#FF6500] uppercase tracking-widest">Pedido Registrado</span>
        <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
          Obrigado por sua compra!
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          Número do pedido: <span className="text-white font-bold">{order.orderNumber}</span> • Data: {formatDate(order.createdAt)}
        </p>
      </div>

      {/* Box Interativo de Pagamento PIX / Simulação */}
      {isPix && (
        <OrderConfirmationClient
          orderId={order.id}
          orderNumber={order.orderNumber}
          pixCode={payment.pixQrCode || '00020126580014br.gov.bcb.pix0136focus-store'}
          pixBase64={payment.pixQrCodeBase64}
          initialStatus={order.status}
        />
      )}

      {/* Detalhes do Pedido */}
      <div className="bg-surface p-6 rounded-2xl border border-white/10 space-y-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/10 pb-3">
          Resumo dos Itens
        </h3>

        <div className="divide-y divide-white/5 space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="pt-3 flex justify-between items-center text-xs">
              <div>
                <p className="font-bold text-white">{item.productName}</p>
                <p className="text-zinc-400">{item.variantName} (x{item.quantity})</p>
              </div>
              <span className="font-semibold text-white">{formatPrice(item.totalPrice)}</span>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-white/10 space-y-2 text-xs">
          <div className="flex justify-between text-zinc-400">
            <span>Subtotal</span>
            <span className="text-white">{formatPrice(order.subtotal)}</span>
          </div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-400">
              <span>Desconto</span>
              <span>-{formatPrice(order.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-zinc-400">
            <span>Frete ({order.shipments[0]?.carrier || 'Focus Express'})</span>
            <span className="text-white">{formatPrice(order.shippingAmount)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-white/10">
            <span>Total</span>
            <span className="text-[#FF6500] text-xl font-black">{formatPrice(order.total)}</span>
          </div>
        </div>

        {/* Endereço de Entrega */}
        <div className="pt-4 border-t border-white/10 text-xs text-zinc-400 space-y-1">
          <p className="font-bold text-white uppercase tracking-wider">Endereço de Entrega:</p>
          <p>{order.shippingStreet}, {order.shippingNumber} {order.shippingComplement}</p>
          <p>{order.shippingNeighborhood} — {order.shippingCity} / {order.shippingState}</p>
          <p>CEP: {order.shippingPostalCode}</p>
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <Link href="/">
          <Button variant="outline" size="sm">Voltar para a Loja</Button>
        </Link>
        <Link href="/conta/pedidos">
          <Button size="sm" className="bg-[#FF6500] hover:bg-[#FF7A1A]">Acompanhar Pedido</Button>
        </Link>
      </div>
    </div>
  );
}