# FocusStore — Decisões arquiteturais

## ADR-001 — Migração incremental

**Status:** aprovado como direção, não aplicado como migração de dados.

O frontend não perderá o Prisma enquanto existirem consumidores diretos. A remoção antecipada criaria uma quebra ampla e dificultaria rollback.

## ADR-002 — PostgreSQL como persistência final

**Status:** planejado.

PostgreSQL será a persistência autoritativa do domínio comercial. SQLAlchemy representa o domínio no backend e Alembic é o proprietário das migrations das tabelas de negócio. Migrations Prisma e Alembic não devem operar a mesma tabela durante a transição.

## ADR-003 — Testes isolados

**Status:** parcialmente implementado.

Testes TypeScript que alteram schema exigem `FOCUS_TEST_DATABASE_URL`, com PostgreSQL local e banco terminado em `_test`. O helper cria schema exclusivo por processo. Testes backend usam SQLite em `tmp_path` quando pytest está disponível.

## ADR-004 — Segurança no servidor

**Status:** implementado parcialmente e aguardando testes dinâmicos.

Identidade de checkout, autorização administrativa, origem da requisição, validação de entrada, uploads e idempotência são decisões do servidor. Valores enviados pelo browser não são autoridade para `userId`, preço ou estoque.

## ADR-005 — Valores monetários

**Status:** pendente de migração.

O Prisma atual contém valores `Float` em partes do modelo. A convergência para PostgreSQL deve usar `NUMERIC/Decimal`, com conversão e comparação de divergências antes da importação.
