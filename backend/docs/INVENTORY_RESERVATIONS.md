# PostgreSQL inventory reservations

The reservation core is internal and is not exposed through FastAPI routes. Prisma remains the source of truth for the existing checkout flow.

`inventory.quantity_available` is free-to-sell stock. Physical stock is the sum of `quantity_available` and `quantity_reserved`. A reservation atomically decreases the former, increases the latter, writes its line items, and appends a `reserve` movement.

Reservations use the state machine `pending -> confirmed|released|expired`. A confirmation is accepted only while the UTC time is strictly before `expires_at`; a pending reservation at or after its deadline cannot be confirmed. The explicit expiration operation is accepted only at or after `expires_at`, and returns the reserved units to available stock. Explicit release/cancellation remains allowed before the deadline and is distinct from expiration in the movement history. Repeating a terminal operation is a no-op; all other invalid transitions fail.

The `(idempotency_scope, idempotency_key)` pair is durable. Its SHA-256 request hash makes a repeated identical request replay the original result, while a changed payload returns a conflict. Variant inventory rows are locked in ascending internal-ID order with `SELECT FOR UPDATE`; database constraints protect non-negative quantities, valid states, unique line items, and one movement per reservation/variant/operation.

The movement table is append-only on PostgreSQL. Expiration is intentionally a service operation so a scheduler or controlled worker can call it later without requiring Redis, Celery, or RabbitMQ. The reservation row is locked before the deadline check, so confirmation and expiration racing at the boundary are serialized by PostgreSQL; the operation that obtains the lock evaluates the current UTC deadline and only one terminal movement is written.
