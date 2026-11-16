# Plano de integração Next.js ↔ FastAPI

## Estado atual

O Prisma/SQLite continua sendo a autoridade de autenticação, carrinho e checkout comercial. O FastAPI oferece catálogo PostgreSQL, reservas e um checkout PostgreSQL opt-in, mas este último permanece desativado por padrão. Não existe fallback silencioso entre os dois checkouts.

## Mapa de endpoints

| Capacidade | Next.js atual | FastAPI | Auth | Estado |
| --- | --- | --- | --- | --- |
| Catálogo de produtos | `src/modules/catalog/catalog.service.ts` | `GET /api/v1/catalog/products` e `/{slug}` | pública | leitura FastAPI atrás de `CATALOG_READ_SOURCE=fastapi` |
| Categorias | mesmo serviço | `GET /api/v1/catalog/categories` e `/{slug}` | pública | contrato compatível via `catalog-api.adapter.ts` |
| Cotação de carrinho | `POST /api/checkout`/serviços Prisma | `POST /api/v1/cart/quote` | pública | FastAPI somente cotação/ disponibilidade |
| Sessão/usuário | `/api/auth/session` | `GET /api/v1/users/me` | cookie `focus_session` | FastAPI lê a sessão Prisma em SQLite readonly |
| Pedidos existentes | `/api/admin/orders` e `OrderService` | `GET /api/v1/orders` | cookie | leitura de snapshots Prisma |
| Checkout | `/api/checkout` e `CheckoutService` | `POST /api/v1/checkout/orders` | cookie + Origin confiável | FastAPI desativado; não migrar automaticamente |
| Cancelamento/pagamento | rotas Next.js/Prisma | `POST /api/v1/checkout/orders/{id}/cancel` e `/payment-simulation` | cookie + Origin confiável | apenas simulador local, não produção |

Erros FastAPI seguem `{"detail": string}`. O adapter deve distinguir `401` (sessão), `403` (origem/autorização), `404` (recurso ou capacidade desativada), `409` (estoque/idempotência/estado), `422` (payload) e `503` (dependência indisponível).

## Contratos

O catálogo usa `public_id` UUID quando disponível; o campo `id` legado não deve ser enviado ao checkout FastAPI como se fosse o identificador Prisma. Preços são decimais serializados pelo FastAPI e normalizados no adapter; `promotional_price: 0.00` é válido e não significa ausência.

Tipos necessários no frontend: `CatalogProduct`, `CatalogVariant`, `CatalogCategory`, `CatalogPage`, `AuthenticatedUser`, `CartItem`, `Reservation`, `Order`, `OrderItem`, `ShippingOption`, `PaymentAttempt`, `OrderStatus` e `ApiError`. Os tipos de pedido Prisma e PostgreSQL devem permanecer namespaces distintos até existir uma autoridade única.

O adapter existente em `src/modules/catalog/catalog-api.adapter.ts` já separa `catalogSource` e marca variantes FastAPI. `src/modules/cart/cart-context.tsx` rejeita misturar identidades FastAPI com o checkout Prisma; essa proteção deve ser mantida.

## Fluxo de compra

1. Autenticar no Prisma e manter `focus_session`.
2. Ler catálogo FastAPI apenas se a flag de leitura estiver habilitada.
3. Selecionar variante por `public_id` e marcar a origem.
4. Bloquear a inclusão de variante FastAPI no carrinho Prisma até existir adapter de checkout explícito.
5. Escolher frete por código de opção, nunca aceitar preço calculado pelo browser.
6. Em futuro cutover, chamar o checkout FastAPI com `public_id`, chave idempotente e Origin confiável.
7. Exibir o pedido somente pelo contrato correspondente à autoridade que o criou.
8. Tratar expiração, cancelamento e pagamento como estados explícitos; não fazer fallback automático para o outro sistema.

Hoje as etapas 1–5 funcionam parcialmente com catálogo FastAPI e checkout Prisma. Reserva, pedido PostgreSQL e simulador existem apenas no backend opt-in/teste. Frete real, provedor de pagamento, webhooks, conciliação e cutover ainda não estão implementados.

## Estratégia de migração

- `CATALOG_READ_SOURCE=prisma` permanece o default.
- Introduzir um adapter server-side para catálogo, nunca expor credenciais ou conectar o browser diretamente ao PostgreSQL.
- Revalidar sessão no FastAPI; não criar segunda identidade.
- Propagar `public_id`, `catalogSource`, request-id e erros tipados.
- Ativar leitura em `observe`/`shadow` somente para comparação, sem autorização de compra.
- Ativar escrita somente após decisão explícita de autoridade, contrato de pagamento, reconciliação, métricas e rollback.
- Não usar fallback silencioso entre Prisma e FastAPI: indisponibilidade deve aparecer como erro observável.

## Bloqueios antes de ativar compras FastAPI

Contrato de pagamento real e webhooks; política de pedidos/refundos; sessão compartilhada em infraestrutura separada; frete oficial; processamento operacional de expiração e outbox; observabilidade e alertas; teste de carga; plano de rollback; migração/reconciliação de clientes; aprovação comercial e de segurança.
