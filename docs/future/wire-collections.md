# Future: Collection Semantics for Entity Methods

## Decision

**Collections are no-op for `$`-methods.** A collection proxy exposes no `$read`, `$update`, `$on`, `$isDirty`, `$revert`, `$getHistory`, `$getClass`, `$getId`, or `$getSnapshot`. Calling any `$`-method on a collection throws.

Callers iterate and invoke per element:

```js
for (const user of users) {
    if (user.$isDirty()) {
        await user.$update();
    }
}
```

## Rationale

- A collection is **just a container of identities**, not an identity itself. It has no `__class` / `__id` to merge against.
- "Removed from this list" almost never means "delete the entity" — conflating them is dangerous.
- Bulk endpoints, ordering, and pagination are application concerns. Wire's job ends at single-entity round-trips; the application composes them.
- Avoids hidden cost: a collection-level `$update` could silently fan out N requests.

## Out of Scope

- Bulk endpoints (`bulkUpdateRouteName`): not provided. Application code calls a custom endpoint directly when needed.
- Reorder / sort persistence: application concern.
- Collection-level history: not tracked. Per-element history is available via `$getHistory()`.
