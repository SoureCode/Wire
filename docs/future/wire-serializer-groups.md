# Future: Serializer Group Convention

## Problem

The identity-based refactor leans on Symfony Serializer with `#[Groups]` to decide what gets exposed to Wire. We have not picked a default group name or a way to vary the group per scope.

## Options

- **Single default group `wire`.** Simple. Every entity field tagged `#[Groups(['wire'])]` is exposed; everything else is ignored. One knob.
- **Read/write split** (`wire:read`, `wire:write`). Lets sensitive fields be readable but not writable from the client.
- **Per-scope group override.** `{% wire user with groups=['wire', 'admin'] %}` — different templates, different exposure. More expressive, more rope.
- **No default — explicit only.** Force devs to pass groups every time. Safe but noisy.

## Open Questions

- Does `#[Ignore]` cover the "never expose" case sufficiently, or do we need a stricter `#[Wire(expose: false)]`?
- Should the group name be configurable in bundle config (`wire.serializer.default_group`)?
- Interaction with API Platform / existing serialization groups in the project — collision risk?
