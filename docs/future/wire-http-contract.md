# Future: HTTP Contract

## Problem

`$update()` accepts `{ method: 'PATCH' }`, but the default behavior, payload shape, and response merge contract are unstated. Real apps need a sharp answer to: PATCH or PUT, full body or diff, what does the server return.

## Defaults

| Method | Source | Body | Server semantics |
|--------|--------|------|------------------|
| `$update()` | `methods` of the configured `updateRouteName`; first wins | **Diff** of changed fields plus identity tags | Apply diff to managed entity; validate; flush; return identity-tagged partial |
| `$read()`   | Always `GET` of `readRouteName` | None | Return identity-tagged full read-group payload |

If the update route declares `methods: ['PATCH']`, `$update` sends a diff. If the route declares `methods: ['PUT']`, `$update` sends the full snapshot (every field in `writeGroups`). `POST` is treated as PUT for body shape but is otherwise opaque to Wire — application is responsible.

Override per call:

```js
await user.$update({ method: 'PUT' });   // force full body
await user.$update({ method: 'PATCH' }); // force diff
```

## Diff Payload (PATCH)

The diff is computed against the last server-confirmed snapshot. Only changed leaf paths ship.

```json
{
    "__class":   "user",
    "__id":      42,
    "__version": 7,
    "name":      "Alice",
    "address":   { "city": "Berlin" }
}
```

- Nested objects ship as the smallest enclosing object containing changed leaves. `address.city` changed → `address: { city: ... }`, not the whole `address`.
- Collections are out of scope — see `wire-collections.md`.
- Empty diff → `$update()` is a no-op, resolves immediately, no request sent. Identity tags alone don't constitute a change.

## Full Payload (PUT)

Every field in `writeGroups`, plus identity tags. Unset optional fields are sent as `null` to express deletion. Servers that don't want PUT semantics should configure the route as `PATCH`.

## Response Shape

Both PATCH and PUT return an identity-tagged partial. The server includes whatever fields it wants the client to refresh — typically the fields it computed (timestamps, derived values, server-corrected casing).

```json
{
    "__class":   "user",
    "__id":      42,
    "__version": 8,
    "updatedAt": "2026-04-26T10:15:00Z"
}
```

Wire merges by identity. Fields the server omits keep their current proxy value — there is no implicit "reset to server" outside `$read({ force: true })`.

## Status Codes

| Status | Meaning | Wire behavior |
|--------|---------|---------------|
| 200 | Updated, body is identity-tagged partial | Merge body |
| 204 | Updated, no body | No merge; mark proxy clean against current local state |
| 422 | Validation failure | See `wire-error-contract.md` |
| 409 | Version conflict | See `wire-optimistic-concurrency.md` |
| 4xx other | Application rejection | Surface as `err.type === 'server'` |
| 5xx | Transient | Surface as `err.type === 'server'`; no auto-retry |

`$read` mirrors this for `200` (merge) and error statuses; `204` and diff payloads are not meaningful for reads.

## Idempotency

`$update` is **not** automatically retried. PATCH is not safely retryable in general (e.g. `count = count + 1`); even PUT may not be on routes with side effects. Application supplies an `Idempotency-Key` header when needed.

## Out of Scope

- JSON Patch (RFC 6902) wire format. Diff above is plain JSON, not a patch document. RFC 6902 is precise but verbose; the simpler shape covers Wire's case.
- Request batching, debounce, optimistic UI commit-then-rollback. See vision: out of scope.
