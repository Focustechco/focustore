import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-6 text-sm text-muted">
      <h1 className="text-3xl font-black text-white uppercase tracking-tight">Política de Privacidade & LGPD</h1>
      <p className="text-xs text-focus font-bold uppercase tracking-wider">Última atualização: Setembro de 2026</p>

      <section className="space-y-3 pt-4">
        <h2 className="text-lg font-bold text-white">1. Coleta e Uso de Dados</h2>
        <p>A Focus Store coleta apenas os dados necessários para o processamento de pedidos, entrega e comunicação transacional (Nome, E-mail, Telefone, CPF e Endereço de Entrega).</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">2. Segurança de Pagamentos</h2>
        <p>Não armazenamos dados completos de cartão de crédito ou códigos de segurança (CVV). Toda transação é tokenizada e processada diretamente por gateways autorizados pelo Banco Central.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">3. Seus Direitos (LGPD)</h2>
        <p>Você pode solicitar a exportação ou exclusão dos seus dados a qualquer momento entrando em contato pelo e-mail suporte@focusstore.com.</p>
      </section>
    </div>
  );
}