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
metadata and `createdAt` remain Prisma-only. FastAPI does not expose checkout,
purchase or stock synchronization operations.
