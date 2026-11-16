# FocusStore — auditoria técnica geral

## Resumo executivo

As Fases 1A–5 estão integradas na `main`. O catálogo FastAPI/PostgreSQL, reservas transacionais, pedidos PostgreSQL opt-in, histórico/outbox, reconciliação readonly e guardrails de migração existem e foram validados em CI. Prisma/SQLite continua autoridade de autenticação e checkout comercial.

O checkout FastAPI e o simulador de pagamento são experimentais e permanecem fail-closed. Não há cutover, pagamento real, scheduler de produção, publicação externa de outbox ou sincronização automática de estoque.

## Correções desta auditoria

| Problema | Correção | Evidência |
| --- | --- | --- |
| Writes com cookie comercial sem validação explícita de Origin | `WriteUser` aplicado a criar/cancelar/simular pagamento | testes HTTP de Origin ausente, não confiável e cross-site |
| Cache privado não cobria checkout | middleware inclui `/api/v1/checkout` com `no-store` e `Vary: Cookie` | teste de resposta privada |
| Promoção zero tratada como ausência | seleção explícita `is not None` | teste PostgreSQL de snapshot monetário |
| Expiração sem processamento operacional | worker interno limitado, reprocessável e sem scheduler | testes PostgreSQL de expiração |
| Outbox sem processador | processor com lock, retry após rollback e semântica at-least-once | teste PostgreSQL com publisher que falha |

## Segurança e integridade

Autenticação continua lendo a sessão Prisma em modo readonly. Autorização de pedidos restringe por `customer_id`. IDs públicos PostgreSQL são UUID. Queries usam parâmetros/SQLAlchemy. Flags default são Prisma/observe; observe e shadow nunca autorizam compras.

CSRF agora exige Origin same-origin ou `FRONTEND_ORIGIN` configurada para writes autenticados. CORS não é tratado como substituto de CSRF. Cache de pedidos, usuário e checkout é privado.

Riscos restantes: infraestrutura separada ainda precisa de uma autoridade de sessão compartilhada; confiança em proxy/HTTPS deve ser definida operacionalmente; rate limiting e observabilidade de produção precisam ser fechados; pagamentos reais, webhook e refund não existem.

## Backend

- Catálogo: filtros, ordenação, paginação, UUIDs, Decimal e fonte PostgreSQL.
- Reservas: locks determinísticos, idempotência, expiração temporal, release/confirm e rollback transacional.
- Pedidos: vínculo 1:1 com reserva, snapshots monetários, histórico e outbox.
- Expiração: `process_expired_reservations()` processa lote bounded em transações curtas e não toca pedidos pagos ou pagamentos não pendentes.
- Outbox: `process_pending_outbox()` publica em modo at-least-once; consumidores devem deduplicar por `event_key`.
- Migrations: nenhum novo schema foi necessário nesta auditoria; o núcleo usa as migrations existentes.

## Frontend

`src/modules/checkout/checkout.service.ts`, pagamentos, pedidos administrativos, cupons, inventário e autenticação continuam Prisma-only. `src/lib/api/focus-api.ts` e `src/modules/catalog/catalog-api.adapter.ts` já suportam leitura do catálogo FastAPI. O carrinho impede misturar variantes FastAPI com checkout Prisma.

O plano detalhado está em `docs/FRONTEND_FASTAPI_INTEGRATION_PLAN.md`.

## Testes e limitações

Nesta execução foram aprovados os testes focados HTTP (`19 passed`) e os testes PostgreSQL de checkout, expiração e outbox (`7 passed`), além de Alembic upgrade/check no banco descartável. A suíte completa, frontend, fullstack, TypeScript e build devem ser repetidos no HEAD final e na CI após publicação.

O warning conhecido é a depreciação de `httpx` no `starlette.testclient`; não foi ocultado.

## Requisitos para produção

Obrigatórios: provedor de pagamento e webhooks; política de refund/conciliação; sessão compartilhada; scheduler/worker supervisionado; outbox consumer idempotente; rate limiting; logs/métricas/alertas; testes de carga e recuperação; revisão de segurança; rollback.

Recomendados: tracing, retenção de eventos, DLQ operacional e testes de falha de rede.

Futuro: cutover gradual, migração de identidade e sincronização controlada de dados após aprovação formal.

## Backlog priorizado

1. Definir contrato de pagamento/refund e webhook — crítico; bloqueia produção.
2. Definir autoridade de sessão entre Next.js e FastAPI — crítico; bloqueia infraestrutura separada.
3. Operacionalizar worker de expiração e outbox — alto; depende de observabilidade.
4. Adicionar métricas de estoque, idempotência e eventos — alto.
5. Implementar adapter de checkout atrás de flag — alto; somente após 1–4.
6. Teste de carga/cutover e rollback — alto; depende de todos os anteriores.

## Classificação

- Merge desta auditoria: depende da CI do PR final; não declarar aprovado antes dela.
- Homologação: apta somente para catálogo, reservas e simulador controlado.
- Produção: NÃO APTA; FastAPI checkout, pagamentos reais e cutover continuam desativados.
