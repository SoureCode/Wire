# Future: Collection Semantics

## Two Things, Don't Confuse Them

1. **Collection container on the client** — the array proxy holding entity proxies. Container has **no** `$`-methods.
2. **List operation on the server** — the repository's `list()` method. Owns filter / sort / pagination.

Both are required for real apps. The first is a hard rule about the proxy surface; the second is a capability of `WireRepositoryInterface` (see `wire-repository.md`).

## Container Rules

A collection proxy exposes no `$read`, `$update`, `$on`, `$isDirty`, `$revert`, `$create`, `$delete`, `$getHistory`, `$getClass`, `$getId`, or `$getSnapshot`. Calling any `$`-method on a collection throws.

Callers iterate and invoke per element:

```js
for (const user of users) {
    if (user.$isDirty()) {
        await user.$update();
    }
}
```

Reasons:

- A collection is a container of identities, not an identity itself. It has no `__class` / `__id` to merge against.
- "Removed from this list" almost never means "delete the entity" — conflating them is dangerous.
- Bulk endpoints, ordering, and pagination are real concerns, but they do not belong on the *container proxy*. They belong on the repository.

## List Fetching Lives on the Repository

Servers fetch collections through `WireListRepositoryInterface::list(WireListContext)`. See `wire-repository.md` for the full surface.

Two client paths:

```twig
{# controller passed any iterable of entities — array, Doctrine Collection, etc. #}
{% wire %}
    {% for user in users %}{{ user.name }}{% endfor %}
{% endwire %}
```

```js
const result = await Wire.list('user', {
    filters: { role: 'admin' },
    page:    1,
});

for (const user of result.items) {
    user.$isDirty();   // each item is a normal entity proxy
}
```

For the Twig path, the `{% wire %}` walker detects per variable whether the value is a single entity or a collection of entities (by iterating once and inspecting the first element's class). It registers the variable under its template name. No `wire_list` tag, no `WireList` envelope, no repository `list()` call required — just pass what Doctrine already gives you.

The JS path is for client-driven filtering / pagination / cursor traversal where the template can't know the parameters in advance; that one goes through `WireListRepositoryInterface::list()` and returns a `WireList` (`items`, `total`, `page`, `pageSize`, `cursor`). `result.items` is a normal collection container — per-element reactivity, no container `$`-methods.

## Mutating Collection Membership

Adding or removing entities from a list is **two operations**, never one:

| Intent | Calls |
|--------|-------|
| Append a new entity to a visible list | `Wire.create(...)`, then `$create()`; application appends the resolved proxy to its rendered array |
| Remove an entity (and delete it) | `entity.$delete()`; application removes from the array on success |
| Remove an entity from this list only | application-defined endpoint; not a Wire concern |
| Reorder | application-defined endpoint; ordering is domain semantics |

Wire never infers "you removed this from the array, so you wanted to delete it." Wire never infers "you assigned this proxy into another scope's array, so you wanted to move it." Membership is always explicit.

## OneToMany / ManyToMany Diffs

Server-side relation diff strategies (`identity`, `replace`, `none`) are configured per relation on the parent's repository, not on the collection container. See `wire-doctrine.md` for the strategy table. Strategies live there because they describe **how the parent's update payload is interpreted server-side**, which is the parent repository's concern.

The client always ships an array of identity-tagged objects in the parent's update body; the parent repository decides what to do with it.

## Out of Scope

- Bulk endpoints (`bulkUpdateRouteName`, `bulkDeleteRouteName`). Compose per-entity calls or write a custom endpoint when one round-trip is mandatory.
- Reorder / sort persistence as a Wire concept. Domain concern.
- Collection-level history. Per-element history is available via `$getHistory()`.
- Streaming / infinite scroll list responses. Use cursor pagination via `WireListContext::$cursor` and let the application drive the loop.
