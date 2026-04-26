# Future: Submit Semantics for Collections

## Problem

`Wire.submit(value)` is well-defined for a single identified entity. Collections are the common Symfony case: a list of `User`s, a paginated table, a tag list. What does `Wire.submit(users)` mean?

## Possible Semantics

- **Save all.** Send the full collection, server replaces. Loud, simple, dangerous.
- **Save dirty.** Wire tracks which elements were mutated since render and sends only those. Requires per-element dirty tracking.
- **Save one.** `Wire.submit(users[0])` — submit operates on the element, not the collection. The collection itself has no submit semantics.
- **No-op.** Collections can't be submitted. Devs iterate and submit each element themselves.

## Open Questions

- Is "the collection" itself an identity, or just a container of identities?
- Add/remove operations — is "deleted from this list" the same as "delete the entity"? Almost never. How do we distinguish?
- Bulk endpoints — does `#[Wire(submit:)]` on the entity scale, or do we need a separate `#[Wire(bulkSubmit:)]`?
- Ordering / reorder — sortable lists are common; does Wire know about order, or is that user code?
