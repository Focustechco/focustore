# Validação funcional do catálogo FastAPI

Este procedimento valida a cadeia Next.js → FastAPI → PostgreSQL sem usar o
`.env` do desenvolvimento e sem executar migrations em um banco persistente.

1. Inicialize uma instância PostgreSQL descartável em um diretório temporário,
   usando um banco cujo nome termine em `_test`.
2. Execute `alembic upgrade head` e `alembic check` com `DATABASE_URL` apontando
   exclusivamente para essa instância.
3. Insira apenas dados sintéticos e inicie o FastAPI com:

   ```text
   CATALOG_SOURCE=postgresql
   FASTAPI_CHECKOUT_ENABLED=false
   CHECKOUT_WRITE_AUTHORITY=prisma
   MIGRATION_MODE=observe
   ```

4. Inicie o Next.js com `CATALOG_READ_SOURCE=fastapi` e
   `FOCUS_API_BASE_URL` apontando para o FastAPI local.
5. Verifique listagem, categoria, busca, filtros, ordenação, detalhe do
   produto, UUIDs públicos, valores monetários e disponibilidade.

O FastAPI é somente leitor para este fluxo. O carrinho permanece bloqueado para
itens marcados como `catalogSource=fastapi`, e checkout, pagamentos, pedidos e
autenticação continuam sob a autoridade Prisma/Next.js. Coleções, reviews,
`isFeatured` e `createdAt` permanecem explicitamente Prisma-only; não há
fallback silencioso para Prisma quando o FastAPI é a fonte configurada.

Na validação de 2026-11-16, a instância foi PostgreSQL 18.6 local,
`127.0.0.1:55452`, banco `catalog_demo_test`, role `catalog_test`, em diretório
`.tmp/catalog-pg-*`. Foram exercitados os endpoints de health, produtos,
categorias e detalhe, incluindo filtros combinados e produto inativo.
