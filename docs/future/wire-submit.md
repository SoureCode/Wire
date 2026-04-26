# Future: Wire.submit() — Server Round-trip Helper

## Problem

`Wire.snapshot()` produces a JSON-serialisable object with the current scope data, but sending it back to the server requires the caller to write boilerplate `fetch` code every time. A thin wrapper could standardise this and make the server-side response shape predictable.

## Proposed API

```js
Wire.submit(scopeName, url, options?)
```

Posts the snapshot of the named scope to `url` and optionally merges the response data back into the proxy.

```js
// fire-and-forget
await Wire.submit('wire_test/user.html.twig', '/api/user/save');

// merge server response back into the scope
await Wire.submit('wire_test/user.html.twig', '/api/user/save', { merge: true });
```

Returns a `Promise<Response>` (or the parsed JSON body when `merge: true`).

## Request Shape

```json
POST /api/user/save
Content-Type: application/json

{ "user": { "name": "Alice", "email": "alice@example.com", "status": "active" } }
```

Same shape as `Wire.snapshot(scopeName)` — no transformation.

## Response Shape (when `merge: true`)

The server returns a partial or full data object. Wire merges top-level keys into the scope proxy, triggering DOM updates for changed paths.

```json
{ "user": { "status": "saved" } }
```

```js
// Proxy updates: user.status → "saved", DOM re-renders bound elements
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `merge` | `boolean` | `false` | Deep-merge response JSON into the scope proxy |
| `method` | `string` | `"POST"` | HTTP method |
| `headers` | `object` | `{}` | Additional request headers |
| `csrfToken` | `string` | `undefined` | Added as `X-CSRF-Token` header |

## Symfony Controller Pattern

```php
#[Route('/api/user/save', methods: ['POST'])]
public function save(Request $request, EntityManagerInterface $em): JsonResponse
{
    $data = json_decode($request->getContent(), true);
    $user->setName($data['user']['name']);
    $em->flush();

    return $this->json(['user' => ['status' => 'saved']]);
}
```

## Open Questions

- Should it support multiple scopes in one request?
- Should there be CSRF protection built-in (Symfony's `csrf_token()` Twig helper writes a token the JS could read)?
- Should failed responses (4xx/5xx) revert the proxy to its pre-submit state?
