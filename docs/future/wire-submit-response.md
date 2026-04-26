# Future: Submit Response Merge by Identity

## Problem

After `Wire.submit(value)`, the server may return updated data. Today's draft `wire-submit.md` merges into a named scope. With identity-based Wire, the merge target is the **identity**, not the scope — and the same entity may appear in multiple scopes, all of which should reflect the update.

## Proposed

Server returns a payload tagged with the same identity scheme:

```json
{ "__class": "App\\Entity\\User", "__id": 42, "status": "saved" }
```

Wire looks up every live proxy with `(__class, __id) == (User, 42)` and merges the partial. All scopes containing that user re-render the affected paths.

## Open Questions

- Partial vs full payload — does the server always return the full entity, or just changed fields?
- What if the server returns an entity that no scope on the page currently holds? Drop, store, or instantiate?
- Errors (4xx/5xx) — revert proxy state? Leave as-is? Surface to a callback?
- Multiple entities returned in one response (e.g. `User` plus their `Address`) — merge each by its own identity?
