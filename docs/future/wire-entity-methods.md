# Future: Entity Proxy Methods

## Problem

`Wire.submit(scopeName, url, options)` is scope-targeted, requires the caller to repeat the URL, and does not compose with the identity-based proxy model. Reload is not supported at all — devs must reissue the original render request and reconcile by hand.

Per-entity behavior belongs on the entity proxy itself.

## Proposal

Remove `Wire.submit`. Move all server interaction onto the entity proxy as `$`-prefixed methods. The `$` prefix reserves a namespace that cannot collide with entity field names.

### Proxy Method Surface

| Method | Purpose |
|--------|---------|
| `$getClass()` | Return entity FQCN (e.g. `"App\\Entity\\User"`) |
| `$getId()` | Return entity identifier |
| `$getSnapshot()` | Return a JSON-serialisable snapshot of the entity's current state |
| `$read(options?)` | Fetch fresh state from the configured read route; merge by identity |
| `$update(options?)` | Send snapshot to the configured update route; merge response by identity |
| `$on(callback)` | Subscribe to any field change on this entity; returns unsubscribe |
| `$on(path, callback)` | Subscribe to changes at `path` (and sub-paths) on this entity; returns unsubscribe |
| `$isDirty()` | `true` if any tracked field differs from the last server-confirmed snapshot |
| `$revert()` | Restore fields to the last server-confirmed snapshot |
| `$getHistory()` | Chronological array of server round-trip records for this entity |

`__class` and `__id` remain on the **wire format** (snapshots, server payloads) for identity routing. They are not exposed as proxy properties — use `$getClass()` / `$getId()`.

## Endpoint Configuration

Endpoints reference Symfony routes by name. URL and HTTP method come from the target `#[Route]` — single source of truth, refactor-safe.

```php
#[Wire(
    readRouteName:   'app_user_read',
    updateRouteName: 'app_user_update',
)]
class User
{
    public function __construct(
        public int $id,
        public string $name,
        public string $email,
    ) {}
}
```

URL is built via `UrlGeneratorInterface`. Route params are auto-resolved by name match against entity fields (`{id}` → `$user->id`).

For static or computed extras, pass `*RouteParams` (optional):

```php
#[Wire(
    updateRouteName:   'app_user_update',
    updateRouteParams: ['locale' => 'en', 'version' => 'v2'],
)]
class User {}
```

Hardcoded params merge over auto-resolved ones. Missing route → method throws.

HTTP method is taken from the target route's allowed `methods` (`#[Route(methods: [...])]`). If the route allows multiple, the first is used; override via the `method` option.

## Usage

```js
const user = Wire.getScope(document.querySelector('#user-name')).get('user');

await user.$update();
await user.$update({ headers: { 'X-CSRF-Token': token } });

await user.$read();

const offEmail = user.$on('email', (next, prev) => {
    console.log('email:', prev, '→', next);
});
offEmail();

const offAny = user.$on((next, prev, path) => {
    console.log(path, ':', prev, '→', next);
});
offAny();

if (user.$isDirty()) {
    user.$revert();
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `method` | `string` | from `#[Wire]` endpoint config | HTTP method override |
| `url` | `string` | configured endpoint | URL override (still subject to `{id}` substitution) |
| `headers` | `object` | `{}` | Additional request headers |

**No `groups` option.** Serializer groups are server-side only. Allowing the client to request groups would let any caller pull data the server did not intend to expose.

## Response Merge

Server response is tagged with identity:

```json
{ "__class": "App\\Entity\\User", "__id": 42, "status": "saved" }
```

Wire looks up every live proxy with matching `(__class, __id)` and merges the partial. All scopes containing that entity re-render the affected paths.

Multiple entities in one response are each merged by their own identity:

```json
[
    { "__class": "App\\Entity\\User", "__id": 42, "name": "Alice" },
    { "__class": "App\\Entity\\Address", "__id": 7, "city": "Berlin" }
]
```

## Symfony Controller Pattern

```php
#[Route('/api/user/{id}', name: 'app_user_update', methods: ['PATCH'])]
public function update(int $id, Request $request, EntityManagerInterface $em): JsonResponse
{
    $data = json_decode($request->getContent(), true);
    $user = $em->find(User::class, $id);
    $user->setName($data['name']);
    $em->flush();

    return $this->json([
        '__class' => User::class,
        '__id'    => $user->getId(),
        'status'  => 'saved',
    ]);
}
```

## History

Every successful `$read` and `$update` appends one record to the entity's in-memory history. Local proxy mutations are **not** recorded. History is per-entity, in-memory only, and cleared on page navigation.

```js
[
    { timestamp: 1714128000123, op: 'read',   snapshot: { id: 42, name: 'Alice', email: 'a@x' } },
    { timestamp: 1714128050000, op: 'update', snapshot: { id: 42, name: 'Alice', email: 'b@x' } },
]
```

Access:

```js
const history = user.$getHistory();
const last = history[history.length - 1];
```

## Collections

Out of scope for this proposal. `$update` / `$read` operate on single-entity proxies only. Collection-level semantics tracked separately in `wire-collections.md`.

## Error and Lifecycle Semantics

- **`$update` failure (4xx/5xx).** Promise rejects with the response. Proxy state is left as-is — no automatic revert. Caller decides whether to call `$revert()`.
- **`$read` with pending local edits.** Throws by default to prevent silent data loss. Pass `{ force: true }` to overwrite local edits with server state.
- **`$on` lifecycle.** Listeners survive `Wire.init()` re-calls. Cleared only on page navigation.
- **Identity-less proxies.** `$update` throws when `__id` is absent. Entity creation is out of scope — identity must exist before round-trip methods are valid.
- **Optimistic concurrency.** Tracked separately in `wire-optimistic-concurrency.md`.
