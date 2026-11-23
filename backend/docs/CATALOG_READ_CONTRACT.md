# Catalog read contract

`GET /api/v1/catalog/products` accepts the same product read filters used by the
Next.js Prisma catalog:

- `category_slug`: active category slug; `todos` means no category filter.
- `search`: case-insensitive match in name, description or brand.
- `sort`: `relevance`, `price_asc`, `price_desc` or `newest`.
- `min_price` and `max_price`: inclusive non-negative base-price bounds.
- `offset` and `limit`: validated pagination (`limit` is at most 100).

Filtering and ordering happen in the repository query before `LIMIT/OFFSET`;
the response `total` is the count after filters. Every order has deterministic
tie-breakers. PostgreSQL uses `created_at` for `newest`; older synthetic SQLite
fixtures without that column use descending source IDs as a deterministic
compatibility fallback.

FastAPI remains a read-only catalog source. Collections, reviews, featured
metadata and `createdAt` remain Prisma-only. The catalog router does not expose
checkout, purchase or stock synchronization operations. Existing experimental
checkout routes elsewhere remain disabled by default; this contract does not
activate them.

The additive 1.1 envelope includes contract_version, and products carry BRL
currency plus their actual catalog_origin. IDs remain unchanged; public_id is
an independent UUID, never an inferred Prisma correspondence. Read prices are
Decimal/HALF_UP with two places and Numeric(10,2) bounds. The adapter exposes
integer minor units while preserving legacy display numbers. See PHASE23_AUDIT.md
for the precision policy, operational constraints and validation evidence.
