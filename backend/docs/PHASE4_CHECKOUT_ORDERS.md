# Fase 4 — checkout e pedidos PostgreSQL

## Limite de autoridade

O checkout Prisma/SQLite continua sendo o escritor ativo do produto. A nova
superfície FastAPI (`/api/v1/checkout/orders`) é um caminho PostgreSQL opt-in e
permanece desativada por padrão. Ela só aceita variantes do catálogo
PostgreSQL, usa `product_variants.public_id` e não consulta nem grava Prisma.
Os pedidos legados em `/api/v1/orders` continuam sendo leitura somente da fonte
Prisma existente; não há fallback ou união entre as duas fontes.

Ativação exige simultaneamente `FASTAPI_CHECKOUT_ENABLED=true`,
`CATALOG_SOURCE=postgresql` e um provedor aprovado. Nesta entrega, o único
provedor é o simulador de testes (`FASTAPI_PAYMENT_SIMULATOR_ENABLED=true`),
que só pode ser usado com `FOCUS_DEBUG=true`. Portanto, a entrega não afirma
pagamento real nem autoriza cutover.

## Transação e invariantes

Uma criação de pedido usa uma transação PostgreSQL única para:

1. validar variantes ativas e calcular preços `Numeric` no servidor;
2. calcular o frete pela política server-side, ignorando preço enviado pelo cliente;
3. adquirir locks de inventário em ordem determinística;
4. criar/reexecutar a reserva com chave idempotente;
5. criar o pedido, snapshots de itens, tentativa de pagamento, histórico e outbox.

Falha em qualquer etapa faz rollback de tudo. A reserva tem vínculo 1:1 com o
pedido e cada movimento de estoque é protegido por uma chave única por reserva,
variante e operação. Confirmação baixa reservado sem devolver disponibilidade;
cancelamento explícito libera; expiração só é permitida quando o prazo chegou.
Não existe scheduler nesta entrega. `CheckoutOrderService.expire` é uma unidade
de trabalho para um worker futuro e não é exposta por HTTP.

O outbox é persistido na mesma transação. A publicação e o retry do evento
precisam de um worker operacional futuro; nenhum envio externo ocorre dentro do
checkout.

## O que ainda não está concluído

- provedor de pagamento real, assinatura/webhook e reconciliação externa;
- autenticação FastAPI como autoridade única; a ponte atual lê `focus_session`
  do SQLite Prisma em modo somente leitura;
- guest checkout e cupons no caminho FastAPI;
- adapter Next.js para alternar a autoridade; a UI permanece no checkout Prisma;
- worker de expiração/publicação de outbox e métricas operacionais.

Essas lacunas são deliberadas para impedir dois escritores e não devem ser
resolvidas habilitando a flag em produção.
