'use client';

import React, { useState } from 'react';
import { Copy, Check, QrCode, Sparkles, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  orderId: string;
  orderNumber: string;
  pixCode: string;
  pixBase64?: string | null;
  initialStatus: string;
}

export function OrderConfirmationClient({
  orderId,
  orderNumber,
  pixCode,
  pixBase64,
  initialStatus,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSimulatePayment = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payments/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: `evt_sim_${Date.now()}`,
          orderId,
          status: 'PAID',
          provider: 'mercadopago_pix_simulator',
        }),
      });

      if (res.ok) {
        setStatus('PAID');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'PAID') {
    return (
      <div className="p-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-4 shadow-xl">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
          <CheckCircle2 size={36} />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-black text-white uppercase tracking-tight">
            Pagamento PIX Aprovado com Sucesso!
          </h2>
          <p className="text-xs text-zinc-300">
            Seu pedido <span className="text-white font-bold">{orderNumber}</span> já entrou em processo de separação e envio.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/20 px-3 py-1.5 rounded-full">
          <ShieldCheck size={16} /> Estoque baixado definitivamente no PostgreSQL
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl bg-surface border border-[#FF6500]/30 shadow-lg shadow-[#FF6500]/10 space-y-5 text-center">
      <div className="flex items-center justify-center gap-2 text-[#FF6500]">
        <QrCode size={22} />
        <h2 className="text-base font-bold text-white uppercase tracking-wider">
          Pague via PIX com 5% de Desconto
        </h2>
      </div>

      <p className="text-xs text-zinc-400 max-w-md mx-auto">
        Abra o aplicativo do seu banco, escolha a opção <strong>Pix Copia e Cola</strong> ou aponte a câmera para o QR Code abaixo:
      </p>

      {/* QR Code */}
      <div className="w-48 h-48 bg-white p-3 rounded-2xl mx-auto flex items-center justify-center shadow-md">
        {pixBase64 ? (
          <img src={pixBase64} alt="QR Code PIX" className="w-full h-full object-contain" />
        ) : (
          <QrCode size={130} className="text-black" />
        )}
      </div>

      {/* Código Copia e Cola */}
      <div className="space-y-2 max-w-md mx-auto">
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={pixCode}
            className="w-full bg-[#101010] border border-white/15 rounded-xl px-3 py-2 text-xs text-zinc-400 font-mono truncate focus:outline-none"
          />
          <button
            onClick={handleCopy}
            className="px-4 py-2 rounded-xl bg-[#FF6500] hover:bg-[#FF7A1A] text-white text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 shadow-sm"
          >
            {copied ? (
              <>
                <Check size={14} /> Copiado!
              </>
            ) : (
              <>
                <Copy size={14} /> Copiar
              </>
            )}
          </button>
        </div>
      </div>

      {/* Botão de Simulação em Ambiente Dev */}
      <div className="pt-2 border-t border-white/10">
        <button
          onClick={handleSimulatePayment}
          disabled={loading}
          className="text-[11px] text-zinc-400 hover:text-emerald-400 underline transition-colors inline-flex items-center gap-1.5"
        >
          {loading ? (
            <>
              <RefreshCw size={12} className="animate-spin" /> Confirmando webhook...
            </>
          ) : (
            <>
              <Sparkles size={12} className="text-emerald-400" /> Simular Confirmação Instantânea de Pagamento (Gateway Webhook)
            </>
          )}
        </button>
      </div>
    </div>
  );
}