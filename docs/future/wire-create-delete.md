# Future: Create and Delete Pipeline

## Why a Separate Spec

`$update` and `$read` operate on a known identity. Create has no identity until the server assigns one; delete removes the identity entirely. Both need different lifecycle handling on the proxy and a different route-resolution path on the server. Folding them into `$update` would smear three distinct contracts into one.

## Create

### Client API

```js
const user = Wire.create('user', {
    name:  'Alice',
    email: 'alice@example.com',
});

await user.$create();           // POST to createRouteName
console.log(user.$getId());     // assigned by server
```

Identity-less proxies are a new lifecycle state:

| State | `__id` | Allowed methods | Notes |
|-------|--------|-----------------|-------|
| **draft**     | absent  | `$create`, `$revert`, `$on`, `$isDirty`, `$getSnapshot` | `$update` / `$read` throw |
| **persisted** | present | full surface | post-`$create` transition |

Drafts are not auto-registered in any scope. The application chooses where to attach them. After `$create` resolves, the proxy is registered by identity and any other scope holding the same `(class, id)` merges in.

### Server Contract

```php
#[Wire(
    createRouteName: 'app_user_create',
    readRouteName:   'app_user_read',
    updateRouteName: 'app_user_update',
    deleteRouteName: 'app_user_delete',
)]
class User { /* ... */ }
```

| Method | HTTP | Body | Response |
|--------|------|------|----------|
| `$create` | `POST` (or route's first allowed) | full snapshot, no `__id` | identity-tagged partial with assigned `__id` and `__version` |

`$create` body is always full (PUT-like). A diff has nothing to diff against.

### Repository Surface

Extends `wire-repository.md`:

```php
interface WireCreateRepositoryInterface
{
    public function create(WireCreateContext $ctx): WirePayload;
}

final class WireCreateContext
{
    public string $class;
    public array  $payload;
    public Request $request;
    public ?UserInterface $user;
    public array  $groups;
}
```

`DoctrineSerializerRepository` (shipped) implements: denormalize → validate → `persist` → `flush` → identity-tagged payload. `DoctrineFormRepository` (shipped) uses `submit($payload, clearMissing: true)` against a `data_class` form. Custom repositories do whatever they like — there is no implicit fallback.

### Validation

422 with RFC 9457 problem document, same shape as `$update`. Errors bind to the draft proxy via `$getErrors()`. Failed `$create` leaves the proxy in **draft** state — no identity assigned, no auto-revert; caller fixes fields and calls `$create` again.

### Constructor Arguments

PHP entities with required constructor args break naive `new $class()`. `DoctrineSerializerRepository` uses `Symfony\Serializer\Normalizer\AbstractNormalizer::OBJECT_CONSTRUCTOR_ARGUMENTS`-style denormalization: payload values map to constructor parameters by name. Missing required args → `WireValidationException` with field-level errors. For complex construction, write a custom repository — that's the explicit escape hatch.

### Identity Hooks

Some apps assign identity client-side (UUIDs, ULIDs):

```js
const user = Wire.create('user', { id: ulid(), name: 'Alice' });
await user.$create();
```

When `__id` is present in the create payload, the server treats it as the canonical id (subject to validator constraints and uniqueness). `DoctrineSerializerRepository` passes it to the constructor. UUID/ULID strategies live in the application — Wire neither generates nor enforces them.

### Optimistic / Tentative Insertion

A common UX pattern: append the new row to a list before the server confirms. Wire supports this without committing:

```js
const draft = Wire.create('user', { name: 'Alice' });
list.push(draft);                     // optimistic
try {
    await draft.$create();            // identity now assigned; list still holds the same proxy
} catch (err) {
    list.splice(list.indexOf(draft), 1);  // application rolls back
}
```

The bundle provides no auto-rollback — silent removal would hide bugs. Application owns the optimistic flow.

## Delete

### Client API

```js
await user.$delete();
user.$isDeleted();   // true
user.$on(...);       // throws after delete
```

### Lifecycle After Delete

| State | Allowed methods |
|-------|-----------------|
| **deleted** | `$isDeleted`, `$getClass`, `$getId`, `$getSnapshot` (frozen) |

All other `$`-methods throw. The proxy stays addressable so the rest of the page can detect the tombstone, but mutation is locked. Existing `$on` listeners fire **once** with `(undefined, prev, '$deleted')` and are then cleared.

Identity is removed from Wire's identity registry. A subsequent `$read` of the same `(class, id)` from another scope receives a fresh proxy (in case the server allows recreation).

### Server Contract

| Method | HTTP | Body | Response |
|--------|------|------|----------|
| `$delete` | `DELETE` (or route's first allowed) | none | 204 (preferred) or 200 with identity tag and `"status": "deleted"` |

Soft-delete (Gedmo `SoftDeleteable`) is invisible to Wire — the entity is gone from the client's perspective; the row is still in the DB. If the application wants soft-delete to behave like an update with a `deletedAt` flag instead, **don't** declare `deleteRouteName`; ship a `$update` that sets the flag. Wire's `$delete` is a tombstone, not a flag-flip.

### Repository Surface

```php
interface WireDeleteRepositoryInterface
{
    public function delete(WireDeleteContext $ctx): void;
}

final class WireDeleteContext
{
    public string $class;
    public mixed  $id;
    public ?int   $version;
    public Request $request;
    public ?UserInterface $user;
}
```

`DoctrineSerializerRepository` implements delete as `find` → version check (see `wire-optimistic-concurrency.md`) → `remove` → `flush`. Throws `WireNotFoundException` (404) or `WireConflictException` (409) on stale version. Custom repositories dispatch a command, soft-delete via filter, or call upstream APIs.

### Cascades and Orphans

Doctrine's `cascade={"remove"}` and `orphanRemoval=true` apply unchanged inside `DoctrineSerializerRepository`. Cascaded deletes in the response are surfaced via a `cascade` array of identity tags, which the client uses to mark related proxies as deleted:

```json
{
    "__class": "user",
    "__id":    42,
    "status":  "deleted",
    "cascade": [
        { "__class": "address", "__id": 7 },
        { "__class": "avatar",  "__id": 3 }
    ]
}
```

`DoctrineSerializerRepository` populates `cascade` from `UnitOfWork::getScheduledEntityDeletions()` after `flush`. Custom repositories populate it manually.

### Concurrency

`$delete` ships `__version` like `$update`. Stale version → `409` per `wire-optimistic-concurrency.md`. The conflict response carries `serverSnapshot` so the client can redisplay the current state instead of marking the proxy deleted.

### Authorization

Symfony voters via `#[IsGranted('DELETE', subject: 'user')]` on the route. `DoctrineSerializerRepository` runs `denyAccessUnlessGranted` before `remove`; custom repositories do their own check. 403 → `err.type === 'auth'`.

## Bundle / Routing

`#[Wire]` recognizes four route names:

| Attribute | Default route | HTTP | Generated controller delegates to |
|-----------|---------------|------|-----------------------------------|
| `readRouteName`   | `_wire_user_read`   | GET    | `WireReadRepositoryInterface` |
| `createRouteName` | `_wire_user_create` | POST   | `WireCreateRepositoryInterface` |
| `updateRouteName` | `_wire_user_update` | PATCH  | `WireUpdateRepositoryInterface` |
| `deleteRouteName` | `_wire_user_delete` | DELETE | `WireDeleteRepositoryInterface` |

Auto-generation is opt-out per operation: omit a route name → no route generated → corresponding `$`-method throws "no route configured" client-side. This makes the surface explicit; an entity that should not be deletable simply omits `deleteRouteName`.

## History

`$create` and `$delete` append to `$getHistory()` like `$update` / `$read`:

```js
[
    { timestamp: ..., op: 'create', snapshot: { ... } },
    { timestamp: ..., op: 'update', snapshot: { ... } },
    { timestamp: ..., op: 'delete', snapshot: { ... } },
]
```

After `$delete`, history is preserved on the (now-tombstoned) proxy until the proxy is garbage-collected — useful for undo UIs that want to reissue a `$create` with the last snapshot. Wire does not provide undo natively; the application composes it.

## Cross-References

- `wire-repository.md` — create/delete are two more repository interfaces; selection order is identical.
- `wire-entity-methods.md` — adds `$create`, `$delete`, `$isDeleted` to the proxy surface.
- `wire-http-contract.md` — create is always full-body POST; delete is bodyless DELETE; both share the response merge contract.
- `wire-optimistic-concurrency.md` — `__version` participation extends to `$delete`.
- `wire-error-contract.md` — `WireNotFoundException` adds `err.type === 'not_found'`.

## Out of Scope

- Bulk create / bulk delete. Per `wire-collections.md`, applications compose per-entity calls or call a custom endpoint.
- Two-phase create (draft persistence). Drafts are client-side only; server sees one POST.
- Undo stack. Build it on top of `$getHistory()` if needed.
