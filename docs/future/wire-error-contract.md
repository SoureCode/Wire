# Future: Error Contract

## Problem

`$update()` and `$read()` reject with raw `{ status, response }`. No normalized shape, no distinction between transport, validation, server, and conflict errors. Application code must inspect status codes by hand and pull validation messages out of arbitrary JSON.

## Proposed

All Wire round-trip rejections share one structured error class.

```js
try {
    await user.$update();
} catch (err) {
    err.type;          // 'validation' | 'conflict' | 'auth' | 'server' | 'network'
    err.status;        // HTTP status, or 0 for network
    err.problem;       // RFC 9457 problem document, or null
    err.errors;        // { [path: string]: string[] } | null
    err.serverSnapshot;// entity snapshot from server, or null
}
```

## Server Contract — RFC 9457

Validation responses use `application/problem+json` per RFC 9457:

```json
{
    "type": "https://wire.dev/problems/validation",
    "title": "Validation failed",
    "status": 422,
    "errors": {
        "name":         ["This value should not be blank."],
        "address.city": ["Invalid city"]
    }
}
```

- Field paths are dot-delimited and match proxy paths (`address.city`, not `address[city]`).
- Empty `errors` object means a global-only problem; use `problem.detail` for the message.
- Symfony bridge: a `ConstraintViolationList` normalizer maps violations to this shape automatically.

## Type Mapping

| Status | `err.type` | Notes |
|--------|------------|-------|
| 422    | `validation` | `errors` populated from `problem.errors` |
| 409    | `conflict`   | `serverSnapshot` populated; see `wire-optimistic-concurrency.md` |
| 401, 403 | `auth`     | Application redirects to login or shows denial |
| 4xx (other) | `server` | Application-level rejection |
| 5xx    | `server`     | Treat as transient; no auto-retry |
| (no response) | `network` | Offline or DNS failure; `status === 0` |

## Field Errors on the Proxy

After a `validation` rejection, errors are bound to the entity proxy:

```js
user.$getErrors();         // { name: [...], 'address.city': [...] }
user.$getErrors('name');   // string[] for one path
user.$isValid();           // false until next successful $update / $read
```

Errors clear automatically on the next successful round-trip and on `$revert()`. They do **not** clear on local mutation — the field stays flagged until the server confirms.

`$on('$errors', cb)` notifies on error-state changes; reserved path, distinct from data subscriptions.

## Out of Scope

- Client-side validation. Wire mirrors server truth; it does not duplicate constraints in JS.
- Retry, backoff, circuit-breaking. Application concern.
- Toast / inline rendering. Templates read `$getErrors()` and render however they want.
