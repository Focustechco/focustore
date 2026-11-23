# PostgreSQL inventory reservations

The reservation core is internal and is not exposed through FastAPI routes. Prisma remains the source of truth for the existing checkout flow.

`inventory.quantity_available` is free-to-sell stock. Physical stock is the sum of `quantity_available` and `quantity_reserved`. A reservation atomically decreases the former, increases the latter, writes its line items, and appends a `reserve` movement.

Reservations use the state machine `pending -> confirmed|released|expired`. A confirmation is accepted only while the UTC time is strictly before `expires_at`; a pending reservation at or after its deadline cannot be confirmed. The explicit expiration operation is accepted only at or after `expires_at`, and returns the reserved units to available stock. Explicit release/cancellation remains allowed before the deadline and is distinct from expiration in the movement history. Repeating a terminal operation is a no-op; all other invalid transitions fail.

The `(idempotency_scope, idempotency_key)` pair is durable. Its SHA-256 request hash makes a repeated identical request replay the original result, while a changed payload returns a conflict. Variant inventory rows are locked in ascending internal-ID order with `SELECT FOR UPDATE`; database constraints protect non-negative quantities, valid states, unique line items, and one movement per reservation/variant/operation.

The movement table is append-only on PostgreSQL. Expiration is intentionally a service operation so a scheduler or controlled worker can call it later without requiring Redis, Celery, or RabbitMQ. The reservation row is locked before the deadline check, so confirmation and expiration racing at the boundary are serialized by PostgreSQL; the operation that obtains the lock evaluates the current UTC deadline and only one terminal movement is written.

The phase 2/3 hardening also refreshes ORM objects under stock/state locks and
checks the PostgreSQL clock after waiting for all stock locks. Quantities and
TTLs are strict bounded integers; at most 100 UUID lines are accepted. Owned
transactions retry only rolled-back deadlocks/serialization failures up to
three attempts. Caller-owned transactions must be retried as a complete unit.

`inventory.unattributed_reserved` accounts for previously reserved quantities
without inventing managed reservations. Deferred guards reconcile reserved
stock with this immutable baseline plus pending reservation items, and verify
matching movements and valid terminal states. Movement history/items cannot be
rewritten or truncated; inventory cannot be reassigned to another variant.
Idempotency keys are retained with the permanent history, without automatic
expiration. Replays report the same identity and its current committed state.

Migration `f7c8d9e0f1a2` preserves existing quantity columns and refuses inconsistent
legacy counters or downgrade with reservation history. See PHASE23_AUDIT.md for
lock costs, recovery, authority boundaries, test evidence and limitations. No
Prisma inventory synchronization or commercial authority transfer is enabled.
