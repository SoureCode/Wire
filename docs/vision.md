# Wire

Server-rendered HTML is dead data. Wire keeps it alive.

Add `data-wire` attributes to elements. Wire bootstraps the data from the server, wraps it in a Proxy, and keeps the DOM in sync. Mutate a plain JS object — DOM updates. Type in an input — data updates. Same object in two templates — both update.

Data goes back to the server via `snapshot()`. Same shape, no transformation.

## What Wire is not

- Not a framework or component system
- Not a client-side renderer — it keeps existing DOM alive, it does not add new nodes
- No computed/derived values
- No virtual DOM, no diffing, no hydration

## Why

Most server-side frameworks force a choice: fully server-rendered (no reactivity) or a JS framework (full hydration, large bundle, complex tooling). Wire occupies the space between: keep server rendering, add targeted reactivity for the data already on the page.

The surface area is intentionally small. Wire syncs data to DOM. Everything else is your responsibility.
