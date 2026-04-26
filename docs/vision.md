# Wire

Server-rendered HTML is dead data. Wire keeps it alive.

Add `data-wire` attributes to elements. Wire bootstraps the data from the server, wraps it in a Proxy, and keeps DOM in sync. Mutate a plain JS object — DOM updates. Type in an input — data updates. Same object in two templates — both update.

Data goes back to the server via `snapshot()`. Same shape, no transformation.

## What Wire is not

- Not a framework or component system
- Not a client-side renderer — it keeps existing DOM alive, it does not add new nodes
- No computed/derived values
