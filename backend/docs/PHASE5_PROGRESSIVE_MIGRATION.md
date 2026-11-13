# Fase 5 — migração progressiva e reconciliação

## Estado desta entrega

Esta fase entrega somente o ensaio bounded de reconciliação do catálogo e os
guardrails de autoridade. `python -m app.agents.progressive_reconciliation`
exige `--dry-run`, aceita apenas PostgreSQL em loopback cujo banco termina em
`_test`, abre uma transação `READ ONLY` e lê o snapshot Prisma via SQLite
`mode=ro`/`query_only`. O relatório não contém PII e não cria candidatos,
verificações, cópias ou alterações de autoridade.

Exemplo com fontes sintéticas:

```powershell
python -m app.agents.progressive_reconciliation `
  --database-url postgresql+psycopg://focusstore@127.0.0.1:55446/phase5_test `
  --prisma-snapshot C:\snapshot\prisma.db `
  --namespace prisma-primary-test --dry-run
```

O relatório separa diagnósticos Prisma/PostgreSQL, vínculos verificados,
pendentes/inconsistentes, classes de equivalência e divergência de identidade.
Preços e estoque são observados, mas não são sincronizados nem usados para
autorizar uma compra.

## Autoridade e rollout

`CHECKOUT_WRITE_AUTHORITY` é `prisma` por padrão; `MIGRATION_MODE` é
`observe` por padrão. O caminho FastAPI exige explicitamente autoridade
`fastapi`, `MIGRATION_MODE=cutover`, catálogo PostgreSQL e a flag do checkout,
além do provedor aprovado; `observe` e `shadow` nunca autorizam compras.
Nenhum código desta fase executa cutover, dual-write, importação ou migration
de dados. Um cutover futuro exigirá snapshot/delta, reconciliação de contagens,
FKs, totais monetários, sessões, mídia e rollback ensaiado em ambiente isolado.

## Fora do escopo ainda

- cópia ou importação de usuários, carrinhos, pedidos, pagamentos ou cupons;
- decisão comercial de autoridade de preços/frete/promoções;
- autenticação única FastAPI e provedor de pagamento real;
- scheduler de expiração e worker de outbox;
- ativação de flags, corte, deploy ou acesso a Supabase.
