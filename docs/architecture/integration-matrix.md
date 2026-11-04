# FocusStore — Matriz de integração

| Funcionalidade | Implementação atual | Endpoint FastAPI | Modelo/fonte atual | Ação necessária | Risco |
| --- | --- | --- | --- | --- | --- |
| Vitrine/listagem | `CatalogService.getAllProducts` via Prisma; canário HTTP opt-in preparado | `GET /api/v1/catalog/products` | Prisma/SQLite por default; endpoint legado lê SQLite | Validar contrato e dados equivalentes; depois trocar a fonte | Alto |
| Produto por slug | Prisma | `GET /api/v1/catalog/products/{slug}` | Prisma/SQLite | Ativar canário somente com dados validados | Alto |
| Categorias | Prisma | `GET /api/v1/catalog/categories` | Prisma/SQLite | Alinhar IDs, contagem e status | Médio |
| Coleções | Prisma | inexistente no FastAPI público | Prisma/SQLite | Criar contrato após o catálogo base | Alto |
| Banners | Prisma | inexistente no FastAPI público | Prisma/SQLite | Definir proprietário de conteúdo | Médio |
| Carrinho | Contexto React + Prisma em partes do fluxo | endpoint FastAPI de quote/cart existente | Prisma/SQLite + regras Next | Migrar após catálogo e autenticação | Alto |
| Checkout | Route Handler Next + Prisma | endpoint comercial equivalente não confirmado | Prisma/SQLite | Centralizar no FastAPI após contrato de sessão | Crítico |
| Pedidos | Serviços Next + leitor legado no backend | rotas FastAPI existentes | Prisma/SQLite | Migrar com histórico e idempotência | Crítico |
| Estoque | Prisma/Next | ajuste de produto FastAPI é simplificado | Prisma por variante; PostgreSQL tem `stock` por produto | Modelar variantes e reservas antes do corte | Crítico |
| Uploads | Route Handler Next, arquivos em `public` | endpoint equivalente não confirmado | filesystem local | Preservar URLs e definir armazenamento futuro | Alto |
| Administração | Route Handlers Next protegidos | CRUD FastAPI parcial | Prisma/SQLite | Migrar por domínio, sem gravação dupla | Alto |
| Autenticação | Sessão/cookie no Next; FastAPI lê fonte legada | identidade FastAPI existente | tabelas Prisma/SQLite | Definir verificação compartilhada de sessão | Crítico |

## Regra de ativação

O canário de catálogo só é habilitado no servidor com `FOCUS_CATALOG_SOURCE=fastapi` e `FOCUS_FASTAPI_BASE_URL`. O default não muda. Não existe fallback silencioso de API para outra base quando o canário é explicitamente ativado; falhas devem aparecer como indisponibilidade.
