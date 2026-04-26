# Future: Optimistic Concurrency

## Problem

Two clients edit the same entity. Both submit. Last write wins, silently. Doctrine supports `#[Version]` for optimistic locking; Wire could carry the version field through the round-trip and let the server reject stale writes.

## Proposed

- On serialization, include the version field in the identity payload (e.g. `__version: 7`).
- On submit, the version is sent back with the data.
- Server compares incoming version to current; mismatch → 409 Conflict.
- Wire surfaces the conflict to a callback, or refuses the merge and re-fetches.

## Open Questions

- Does Wire know about `#[Version]` automatically (via Doctrine metadata) or does the dev opt in?
- What does the client do on 409? Refetch? Show a diff? Drop the user's edits? Configurable per call?
- Interaction with response merge — if the server returns the new version after a successful save, the client must update the version field too.
- Does this stay opt-in, or does it become the default for any entity that has a `#[Version]` field?
