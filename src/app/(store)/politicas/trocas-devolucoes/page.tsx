import React from 'react';

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default function ReturnsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-6 text-sm text-muted">
      <h1 className="text-3xl font-black text-white uppercase tracking-tight">Trocas e Devoluções</h1>
      <p className="text-xs text-focus font-bold uppercase tracking-wider">Garantia Focus Store</p>

      <section className="space-y-3 pt-4">
        <h2 className="text-lg font-bold text-white">1. Arrependimento de Compra (CDC)</h2>
        <p>Você tem até 7 (sete) dias corridos após o recebimento para solicitar a devolução e reembolso total.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">2. Troca de Tamanho</h2>
        <p>A primeira troca por tamanho é 100% gratuita. O produto deve estar em estado novo com etiquetas originais.</p>
      </section>
    </div>
  );
}