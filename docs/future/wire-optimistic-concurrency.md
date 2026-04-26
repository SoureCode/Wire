# Future: Optimistic Concurrency

## Problem

Two clients edit the same entity. Both call `$update()`. Last write wins, silently. Doctrine supports `#[Version]` for optimistic locking; Wire can carry the version field through every round-trip and let the server reject stale writes.

## Proposed

- Wire reads the entity's `#[Version]` field via Doctrine metadata and includes it in the identity payload as `__version`.
- `$update()` sends `__version` alongside the snapshot.
- The server compares the incoming `__version` to the current row. Mismatch → `409 Conflict` with the current server snapshot in the response body.
- A successful `$update()` response carries the new `__version`. Wire merges it back into the proxy by identity.
- `$read()` refreshes both data and `__version`.

## Conflict Handling

`$update()` Promise rejects on `409` with a structured error:

```js
try {
    await user.$update();
} catch (err) {
    if (err.status === 409) {
        const serverState = err.serverSnapshot;
        // application decides: refetch, show diff, or force overwrite
    }
}
```

Per the entity-methods spec: proxy state is **not** auto-reverted on failure. The application chooses the recovery path.

Forced overwrite path: call `$read({ force: true })` to discard local edits and pull the server state, then re-edit and re-`$update()`.

## Configuration

- **Default opt-in.** Any entity with a `#[Version]` field automatically participates. No extra flag needed.
- Entities without `#[Version]` send no `__version`; server skips the check.
- No JS-side toggle. Server-side authority decides whether to enforce.

## Resolved Semantics

- **Wire field name.** Always `__version`, alongside `__class` / `__id`. Server resolves to the actual `#[Version]` property; PHP naming is invisible to the client.
- **409 response shape.** Always includes `serverSnapshot` with the current entity state. Standard contract; clients can always recover without a separate refetch round-trip.
- **Recovery after 409.** Always manual. Wire never auto-refetches or auto-merges on conflict — that would silently hide the disagreement.
- **Multi-entity responses.** Each entry carries its own `__version`. Identity-based merge routes per entity; version is just one more tagged field per record.
