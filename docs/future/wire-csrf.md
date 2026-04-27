# Future: CSRF and Authenticated Requests

## Problem

`$update()` posts JSON to a Symfony route. Without CSRF, any third-party page can forge a request from the user's authenticated browser. Manually threading a token through every `$update({ headers })` call is error-prone.

## Proposed

Wire injects a CSRF token automatically on every state-changing round-trip (`$update`, future `$delete`). Read-only methods (`$read`) do not send a token.

### Bootstrap

The server emits the token once, in the Wire bootstrap payload rendered by the `{% wire %}` tag:

```html
<meta name="wire-csrf" content="{{ csrf_token('wire') }}">
```

Wire reads this once on `Wire.init()` and caches it. Header name and meta name are configurable; defaults:

| Setting | Default |
|---------|---------|
| Header  | `X-CSRF-Token` |
| Token id | `wire` |
| Meta name | `wire-csrf` |

### Per-Request Override

```js
await user.$update({ headers: { 'X-CSRF-Token': customToken } });
```

Explicit headers always win.

### Server Validation

Symfony bridge ships a `WireCsrfListener` that validates the token on every route tagged `#[Wire(...)]` with a non-GET method. Failures return `403` with an RFC 9457 problem; surfaces as `err.type === 'auth'`.

## Token Rotation

On a `403` with `problem.type === 'https://wire.dev/problems/csrf'`, Wire refetches the token from a configured endpoint (default `/_wire/csrf`) and retries the original request **once**. Second failure rejects.

Rotation is opt-in: stateless APIs using SameSite cookies and `Origin` checks may disable it.

## Cookies and Session

Wire requests use `credentials: 'same-origin'` by default. Cross-origin deployments must set `credentials: 'include'` and configure CORS on the Symfony side; Wire does not paper over CORS misconfiguration.

## 401 vs 403

| Status | Meaning | `err.type` |
|--------|---------|------------|
| 401 | Session expired or absent | `auth` |
| 403 | Authenticated, not allowed (voter or CSRF) | `auth` |

Application decides whether to redirect to login on `401`. Wire does not auto-redirect — it would hide programming errors and break SPA-shaped flows.

## Out of Scope

- OAuth / bearer-token flows. Application supplies headers per request.
- Double-submit cookie schemes. Stick with Symfony's CSRF component.
- Refresh-token rotation.
