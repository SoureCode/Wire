# Wire — JavaScript API

## Bundle

The Wire client is available as:

- **ESM** (`dist/wire.js`) — for module bundlers
- **IIFE** (`dist/wire.iife.js`) — for direct `<script>` inclusion, exposed as `window.Wire`

```html
<script src="/wire.js"></script>
```

Wire initialises automatically on `DOMContentLoaded`.

## API

### `Wire.getScope(element)`

Returns the scope handle for the scope containing `element`, or `null` if the element is outside any scope.

```js
const button = document.querySelector('#save');
const scope  = Wire.getScope(button);
const user   = scope.get('user');   // same name as in Twig

user.name = 'Bob';                   // mutates → DOM updates
await Wire.submit(user);             // server round-trip
```

The handle exposes:

| Method | Returns |
|--------|---------|
| `scope.get(name)` | the reactive proxy for the Twig variable named `name` |
| `scope.getSnapshot()` | deep clone of the scope's data, identity tags stripped |
| `scope.getSnapshot(name)` | deep clone of just one variable's data, identity tags stripped |

Variable names match what the developer wrote in Twig — Wire never asks the developer to know scope identifiers, sha256 hashes, or class FQCNs.

### `Wire.submit(value, options?)`

Posts an identified entity to its server-side route.

```js
const user = scope.get('user');
await Wire.submit(user);
```

`value` must carry a `__submit` tag — meaning it was rendered from a Doctrine entity decorated with `#[Wire(submit: 'route_name')]`. The URL and HTTP method come from the tag (resolved server-side from the route definition); identity tags are stripped from the request body.

`options` accepts any `RequestInit` field. `url`, `method`, and `headers` are merged with the server-emitted defaults; everything else (signal, credentials, …) passes straight to `fetch`.

Throws if `value` has no `__submit` tag.

### `Wire.init()`

Parses all scopes in the current document and starts the mutation observer. Called automatically on `DOMContentLoaded`. Safe to call again if new scope markup is injected.

## Reactive Proxy

The proxy returned by `scope.get(name)` is recursive. Assigning to any property — at any depth — triggers a DOM update for every binding (text or attribute) that reads the changed path.

```js
const user = scope.get('user');
user.name = 'Bob';                  // updates every {{ user.name }} on the page
user.address.city = 'Paris';        // updates {{ user.address.city }}
```

Each proxy also exposes per-object helpers:

| Method | Returns |
|--------|---------|
| `value.getSnapshot()` | deep clone of the proxied object, identity tags stripped |
| `value.isEntity()` | `true` iff the value carries `__class` + `__id` |
| `value.getClass()` | the entity's class token (FQCN in debug, sha256 prefix in prod). Only present on entities. |
| `value.getId()` | the entity's identifier. Only present on entities. |
| `value.getScope()` | the `ScopeHandle` of the containing scope |

## Two-way Binding

Form controls (`<input>`, `<textarea>`, `<select>`) whose `value` attribute renders a pure-path expression — `value="{{ user.name }}"` — get an automatic `input` event listener. Typing writes the new value back to that path, which propagates to every other binding for the same path.

Two-way is only enabled for *pure* paths; `value="{{ user.name|upper }}"` produces a one-way (read-only) binding because the filter chain isn't invertible.

## How the DOM Stays in Sync

Wire emits two flavours of marker at compile time:

```html
<!-- text-content prints -->
<h1><!--w:{"p":"user.name"}-->Alice<!--/w--></h1>

<!-- attribute-context prints (one or more in the same attribute) -->
<input value="Alice" wire:value='{"p":"user.name"}'>
<a class="card-active" wire:class='{"parts":[{"l":"card-"},{"p":"user.status"}]}'>…</a>
```

On boot the client walks the DOM, pairs up `<!--w:JSON-->`/`<!--/w-->` comments around their text-node placeholder, and finds every element carrying a `wire:*` attribute. It registers a binding for each.

Path mutations are routed via `evaluateBinding(descriptor, scopeData)`:

- `{ p: 'a.b' }` → resolve dot-path
- `{ p, f: [['upper'], ['default','x']] }` → resolve, then replay the filter chain
- `{ parts: [{l:'…'}, {p:'…'}, …] }` → rebuild the string from literals + path values

The `MutationObserver` watches for new subtrees and registers any markers + `wire:*` attributes they contain.

## Identity-based Dedup

Every entity carries a `__class` + `__id` tag in the scope JSON. After parsing, Wire walks every scope's data tree and collapses any objects sharing identity into a single canonical JS instance — so cross-scope mutations propagate naturally through the proxy / refMap.

The server pre-dedups top-level same-instance roots with `$ref` to avoid emitting the same entity twice in one render; the client identity-unify pass handles nested same-entity dedup.

## Snapshot

`scope.getSnapshot()` returns a deep clone of the scope's data with `__class` / `__id` / `__submit` stripped — the user-visible data shape, ready to log or post manually if needed.

## Element-driven Discovery

Wire's API is element-driven: you start from a DOM element you already have (a clicked button, a form, a node from a CSS query) and call `Wire.getScope(element)`. The scope identifier (template path / sha256 prefix) is never user-facing — it lives only in the comment marker that wraps the scope, and reading it directly is a debug-only escape hatch.
