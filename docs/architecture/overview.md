# FocusStore — Visão arquitetural

## Estado confirmado

O sistema atual é um monólito híbrido:

```text
Browser
  └─ Next.js / TypeScript
       ├─ páginas e componentes
       ├─ Route Handlers /api
       └─ Prisma Client ── SQLite legado/configurado no frontend

FastAPI / Python
  └─ SQLAlchemy + Alembic ── PostgreSQL/Supabase
       └─ leitor somente leitura do catálogo SQLite legado
```

O frontend ainda consulta Prisma diretamente em serviços e handlers. Não foi confirmado um fluxo de catálogo, checkout ou pedidos do frontend passando pelo FastAPI. O backend possui rotas próprias, mas ainda não é a fonte única do domínio comercial.

Foi preparado um canário opt-in para a vitrine: `FOCUS_CATALOG_SOURCE=fastapi` faz o `CatalogService` consultar `FOCUS_FASTAPI_BASE_URL` e adaptar o contrato snake_case da API para os componentes existentes. O default continua sendo Prisma; o endpoint FastAPI atual ainda usa o adaptador SQLite legado, portanto esse canário não representa a conclusão da migração para PostgreSQL.

## Direção aprovada

```text
Browser
  └─ Next.js (UI, sessão e cliente HTTP tipado)
       └─ FastAPI (regras de negócio e autorização)
            └─ SQLAlchemy ── PostgreSQL
                 └─ Alembic, único proprietário das tabelas de negócio
```

Prisma deve permanecer durante a transição. Cada domínio será migrado individualmente e somente depois de seus consumidores terem sido substituídos e testados.

## Limites

- Nenhuma migration foi aplicada por este trabalho.
- SQLite legado e Supabase continuam preservados.
- A arquitetura alvo é um monólito modular; não há necessidade concreta de microsserviços, filas ou novos brokers.
- A fonte autoritativa por domínio deve ser registrada antes de cada corte.

## Pontos ainda não verificados

- Contratos completos entre frontend e endpoints FastAPI.
- Compatibilidade integral entre o modelo Prisma e o modelo SQLAlchemy para pedidos, variantes, imagens e estoque.
- Teste dinâmico contra PostgreSQL local descartável.
