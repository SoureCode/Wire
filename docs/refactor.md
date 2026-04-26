# Identity-Based Wire

## Core Model

Wire has two axes, kept separate:

- **Scope** — a template render boundary. Where data lives on the page. Template path is a debug label, nothing more.
- **Identity** — a per-value tag (`class` + `id`) derived from Doctrine metadata. Travels with each entity wherever it appears.

Operations that ask "what is this thing?" (e.g. submit) use identity. Operations that ask "where on the page?" use scope. Same `User` rendered in three templates → three scopes, one identity.

## Decisions

| Topic | Decision |
|---|---|
| Identity source | Doctrine metadata (class + id field) |
| Arrays / DTOs | Allowed. No identity, no `submit()`. Pass through as-is. |
| Payload | Symfony Serializer. `#[Ignore]` and `#[Groups]` decide field exposure. Full object minus filtered fields. |
| Identity tag (dev) | `{"__class": "App\\Entity\\User", "__id": 42, ...fields}` |
| Identity tag (prod) | `{"__class": "<sha256-prefix>", "__id": 42, ...fields}` — class FQCN hashed, same pattern used for scope IDs |
| Submit target | `#[Wire(submit: 'route_name')]` attribute on the entity. Bundle resolves route → URL. |
| Dedup | Same entity in multiple scopes → emitted once, subsequent occurrences are `{"$ref": "scope#path"}`. |
| Dependencies | Hard deps on `symfony/serializer` and `symfony/property-access`. Symfony-only project. |

## Why Full Object Serialization

Wire does **not** create DOM nodes. The full-object payload exists so a developer can hand-author additional markup that references fields the original template did not bind — and Wire lights it up because the data is already in the scope. Wire syncs; the developer authors HTML.

`#[Ignore]` / `#[Groups]` on the entity decide what's actually exposed. Sensitive fields stay server-side.

## Out of Scope

See `docs/future/`:

- `wire-serializer-groups.md` — group name convention
- `wire-submit-response.md` — response merge semantics by identity
- `wire-collections.md` — `submit()` on collections
- `wire-optimistic-concurrency.md` — version field round-trip
