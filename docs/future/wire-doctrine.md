# Future: Doctrine Integration

## Position

Doctrine is reached **through repositories**, never around them. The bundle ships `DoctrineSerializerRepository` and `DoctrineFormRepository` (see `wire-repository.md`, `wire-form-bridge.md`); both compose a small set of Doctrine helpers. Custom repositories that want Doctrine semantics reuse the same helpers. The framework has no implicit Doctrine path — if a repository does not call `EntityManager`, no `EntityManager` work happens.

This spec covers the helpers and the contracts a Doctrine-backed repository must honor.

## Identity Helper

`Wire\Bridge\Doctrine\IdentityExtractor` produces `__class` / `__id` / `__version` from any managed entity:

- `__class` — root class for inherited entities (single-table or joined inheritance), so polymorphic responses route correctly client-side.
- `__id` — single value for simple ids; object `{ field: value, ... }` for composite ids. Composite ids are first-class, not flattened.
- `__version` — value of the `#[Version]` field if present (see `wire-optimistic-concurrency.md`).

Identity is computed from a **managed** entity. A detached or new entity throws — repositories that handle drafts (see `wire-create-delete.md`) call the extractor only after `persist` + `flush` returns identity.

## Lazy Proxies

Twig templates that touch `user.address.city` would normally trigger lazy loading mid-render. The bundle's bootstrap renderer:

1. Walks the entity per the resolved read groups once.
2. Calls `EntityManager::initializeObject()` on every proxy reached.
3. Hands the now-initialized graph to the repository's `read()` for serialization.

Side effect: bootstrap forces N+1 fetches Twig would have done anyway, but in one observable place. `wire:debug --lazy` lists every initialized proxy per request — the canonical hook for spotting and fixing N+1s.

This pre-walk is bundle-level, not repository-level: it happens before the repository runs, regardless of which repository serves the read. Repositories that don't want it (search index reads, projection reads) opt out via `#[Wire(bootstrap: false)]` and supply their own bootstrap data.

## Partial Objects

Doctrine partial objects (`partial User {id, name}`) are explicitly **not supported** as Wire roots. The serializer cannot tell a missing field from a null one; a partial would silently ship nulls and the diff layer would treat them as deletions. `wire:debug` errors at startup if a route returns a partial.

For slim reads, narrow `readGroups`. Groups express intent; partial objects do not.

## Unit of Work in Update Repositories

Update repositories operate on **managed** entities only. Canonical pattern (used by `DoctrineSerializerRepository`):

```php
$user = $em->find(User::class, $ctx->id);
if ($user === null) {
    throw new WireNotFoundException();
}

$serializer->denormalize($ctx->payload, User::class, context: [
    AbstractNormalizer::OBJECT_TO_POPULATE => $user,
    'groups' => $ctx->groups,
]);

$validator->validate($user, groups: $ctx->validationGroups);
$em->flush();

return $payloadBuilder->of($user);
```

- `OBJECT_TO_POPULATE` keeps the same instance; UoW sees real change sets.
- `flush()` runs lifecycle callbacks (`#[PrePersist]`, `#[PreUpdate]`, …) and Symfony events (`prePersist`, `preUpdate`) untouched.
- Wire never bypasses listeners. SoftDelete, Timestampable, Blameable, audit logs — all keep working.

Custom repositories that dispatch via command bus skip `OBJECT_TO_POPULATE` and never call `denormalize` — that's the point of writing one.

## Relations

| Relation | Wire payload | Server semantics |
|----------|--------------|------------------|
| `OneToOne` (owning) | identity-tagged object | Replace by id |
| `ManyToOne` | identity-tagged object | Replace by id |
| `OneToMany` | array of identity-tagged objects | Diff (see strategies below) |
| `ManyToMany` | array of identity-tagged objects | Diff (see strategies below) |
| `Embedded` | nested plain object | Inline value object |

Collection diffing follows `wire-collections.md`: per-element `$update`/`$read` is the supported path. `DoctrineSerializerRepository` ships an opt-in server-side diff applier:

```php
#[Wire(
    repository:        DoctrineSerializerRepository::class,
    repositoryOptions: [
        'collectionStrategies' => [
            'lines' => 'identity',     // match by __id
            'tags'  => 'replace',      // clear and refill (PUT-style)
        ],
    ],
)]
class Order { /* ... */ }
```

Strategies:

- `identity` — match by `__id`; missing → orphan-removed (if mapping says so) or detached.
- `replace` — clear and refill. Safe default for value-object collections.
- `none` — collection is read-only via Wire; mutations rejected by the repository.

`orphan_removal` on the mapping is respected; the repository feeds ORM a consistent change set, never overrides ORM semantics.

## Concurrency

`#[Version]` participation is automatic for any repository that calls `EntityManager::flush()`. Doctrine throws `OptimisticLockException`; the bundle's `WireExceptionListener` maps it to `409` with `serverSnapshot`. See `wire-optimistic-concurrency.md`.

Custom repositories that don't use Doctrine implement concurrency manually and throw `WireConflictException(serverSnapshot)` — the same error type, same wire shape.

## Filters and Multi-Tenancy

Doctrine SQL filters (e.g. `Gedmo\SoftDeleteable`, tenant filter) apply to `EntityManager::find` inside `DoctrineSerializerRepository`. The bundle never disables them. A repository that needs different filter behavior toggles them itself before calling `find`.

## Lifecycle Hooks

The bundle dispatches its own events around the repository call, distinct from Doctrine events:

| Event | When | Use |
|-------|------|-----|
| `wire.before_repository`     | before any repository operation | request-level instrumentation |
| `wire.after_repository`      | after successful operation | broadcast, audit |
| `wire.repository_exception`  | repository threw | logging hook before exception listener maps it |

Symfony events, dispatched via the standard dispatcher; listen with `#[AsEventListener]`.

## Out of Scope

- ODM (Doctrine MongoDB). Future work; out of this spec.
- Multi-EntityManager routing. Repositories pick the EM they need; the bundle does not.
- Read replicas / write splitting. Doctrine concern, applied inside the repository if needed.
