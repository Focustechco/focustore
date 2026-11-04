# FocusStore — Plano incremental de migração

## Fase 1 — Segurança e configuração

Corrigir autorização, CSRF/origem, mensagens de erro, uploads, estoque e proteção de histórico. Critério: typecheck, revisão de diff e testes isolados aprovados.

## Fase 2 — Contrato frontend/API

Criar cliente HTTP tipado para o FastAPI e migrar primeiro consultas de catálogo. Manter Prisma para os domínios ainda não migrados. Critério: uma única origem por endpoint e testes de contrato.

## Fase 3 — Modelo PostgreSQL

Comparar Prisma, SQLAlchemy e schema real coluna a coluna. Definir IDs, `NUMERIC`, constraints, índices e relacionamentos. Criar migrations somente para revisão; aplicar apenas em banco descartável inicialmente.

O schema Prisma atual ainda declara SQLite. Antes dos testes Prisma em PostgreSQL será necessário decidir entre um client de teste separado ou a migração controlada do provider, sem alterar o runtime SQLite existente.

## Fase 4 — Importação do catálogo

Fazer inventário dos dois SQLite, resolver equivalências por SKU/slug, preservar IDs ou tabela de correspondência e copiar imagens sem sobrescrever arquivos. Validar contagens, somas de preços, variantes, categorias e referências.

## Fase 5 — Checkout e pedidos

Migrar carrinho, reservas, pedidos e pagamentos para FastAPI/SQLAlchemy em uma janela controlada. Manter idempotência, histórico e autorização. Prisma só pode ser removido após métricas e rollback verificados.

## Fase 6 — Corte e produção

Executar testes de integração, backup restaurável, observabilidade, revisão de permissões, plano de rollback e só então remover consumidores legados.

Nenhuma dessas fases autoriza alteração do Supabase compartilhado por si só.
