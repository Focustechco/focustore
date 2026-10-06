import React from 'react';

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-6 text-sm text-muted">
      <h1 className="text-3xl font-black text-white uppercase tracking-tight">Termos de Uso</h1>
      <p className="text-xs text-focus font-bold uppercase tracking-wider">Última atualização: Setembro de 2026</p>

      <section className="space-y-3 pt-4">
        <h2 className="text-lg font-bold text-white">1. Propriedade Intelectual</h2>
        <p>Todo o conteúdo, marcas, logotipos e identidades visuais da Focus Store são de propriedade exclusiva da Focus Brand.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">2. Preços e Disponibilidade</h2>
        <p>Os preços dos produtos exibidos no catálogo podem ser alterados sem aviso prévio. A reserva do produto só é garantida após a finalização do pedido com estoque reservado.</p>
      </section>
    </div>
  );
}