# Checklist de integração frontend ↔ FastAPI

## Antes de habilitar leitura FastAPI

- [ ] Definir `CATALOG_READ_SOURCE=fastapi` somente no ambiente de homologação.
- [ ] Configurar `FOCUS_API_BASE_URL` como origem HTTPS sem credenciais.
- [ ] Confirmar timeout, logs sem tokens e tratamento de `401/403/404/409/422/429/503`.
- [ ] Validar paginação, filtros, ordenação, categorias, UUIDs e preço promocional zero.
- [ ] Confirmar que o carrinho não mistura variantes Prisma e FastAPI.

## Antes de qualquer escrita FastAPI

- [ ] Aprovar autoridade única de sessão em infraestrutura separada.
- [ ] Configurar `FRONTEND_ORIGIN` e proteção CSRF.
- [ ] Aprovar contrato de pagamento, webhook, refund e conciliação.
- [ ] Implementar adapter server-side atrás de flag desligada por padrão.
- [ ] Garantir que erro FastAPI não faça fallback automático para Prisma.
- [ ] Executar testes de concorrência, idempotência e rollback em PostgreSQL.

## Antes de produção

- [ ] Scheduler supervisionado para expiração.
- [ ] Consumidor de outbox idempotente e observável.
- [ ] Rate limiting, métricas, tracing e alertas.
- [ ] Teste de carga, recuperação e rollback.
- [ ] Aprovação humana de cutover e plano de reversão.

O checkout Prisma permanece a autoridade até todos os itens de escrita e produção serem aprovados.
