# Wire — JavaScript API

## Bundle

The Wire client is available as:

- **ESM** (`dist/wire.js`) — for module bundlers
- **IIFE** (`dist/wire.iife.js`) — for direct `<script>` inclusion, exposed as `window.Wire`

```html
<script src="/wire.js"></script>
```

Wire initialises automatically on `DOMContentLoaded`. Manual initialisation:

```js
import { init } from '@sourecode/wire';
init();
```

## API

### `Wire.get(name, index?)`

Returns the reactive Proxy for the scope with the given name.

```js
const user = Wire.get('wire_test/profile.html.twig');
user.name = 'Alice';  // → all data-wire="user.name" elements update
```

- `name` — scope identifier (template path in debug, sha256 prefix in prod)
- `index` — when the same template renders multiple times (e.g. in a loop), selects the nth instance. Defaults to `0`.
- Returns `undefined` if no scope with that name exists.

### `Wire.getAll(name)`

Returns an array of all proxies for the given scope name. Returns `[]` if no scopes match.

### `Wire.snapshot(name?)`

Returns a deep clone of the current scope data with all `$ref` aliases resolved and all identity tags (`__class`, `__id`, `__submit`) stripped — i.e. the user-visible data shape.

```js
const data = Wire.snapshot('wire_test/profile.html.twig');
console.log(data.user.name);  // "Alice"

const all = Wire.snapshot();
// → [{ scope: 'wire_test/profile.html.twig', data: { user: {...} } }, ...]
```

Returns `null` for an unknown scope name.

### `Wire.submit(value, options?)`

Posts an identified entity back to its server-side route.

```js
const user = Wire.get('wire_test/profile.html.twig').user;
await Wire.submit(user);
```

`value` must carry a `__submit` tag — i.e. it was rendered from a Doctrine entity decorated with `#[Wire(submit: 'route_name')]`. The URL and HTTP method are read from the tag (server resolves both at render time from the route definition). Identity tags are stripped from the request body.

`options` accepts any `RequestInit` field. `url`, `method`, and `headers` are merged with the server-emitted defaults — anything else (signal, credentials, …) passes straight to `fetch`.

Throws if `value` has no `__submit` tag.

### `Wire.init()`

Parses all scopes in the current document and starts the mutation observer. Called automatically on `DOMContentLoaded`. Safe to call again if new scope markup is injected.

## Reactive Proxy

`Wire.get()` returns a recursive `Proxy`. Assigning to any property — at any depth — triggers a DOM update for all bound elements at that path or below.

```js
const proxy = Wire.get(scope);
proxy.user.name = 'Bob';           // updates data-wire="user.name"
proxy.user.address.city = 'Paris'; // updates city, address, and user bindings
```

## Two-way Binding

Elements with `data-wire="path:value"` get an `input` event listener. Typing writes the new value into the proxy, which propagates to every other element bound to the same path.

## Identity-based Dedup

Each rendered entity carries a `__class` + `__id` tag. After parsing, Wire walks every scope's data tree and collapses any objects sharing identity into one canonical JS object. Existing cross-scope refMap then propagates mutations: changing a field on the entity in one scope updates every binding in every scope that referenced it.

For top-level same-instance roots (the common case where the *same* `User` is the root variable in two scopes), the server already emits a `$ref` so the second scope reuses the first scope's data directly.

## Scope Names

In debug mode (`APP_DEBUG=1`), scope names equal the Twig template path. In production (`APP_DEBUG=0`), they are 8-character sha256 hex prefixes. To write code that works in both modes, read the scope name from the DOM:

```js
function getScopeName() {
    const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
    let node;
    while ((node = walker.nextNode())) {
        const text = node.textContent.trim();
        if (text.startsWith('wire-scope:')) return text.slice('wire-scope:'.length);
    }
    return null;
}

const proxy = Wire.get(getScopeName());
```

Or enumerate via `Wire.snapshot()` (no args).
