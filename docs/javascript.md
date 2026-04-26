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

Returns an array of all proxies for the given scope name.

```js
const items = Wire.getAll('wire_test/item.html.twig');
items[0].name = 'First';
items[1].name = 'Second';
```

Returns `[]` if no scopes match.

### `Wire.snapshot(name?)`

Returns a deep clone of the current scope data, with all `{$ref}` aliases resolved.

```js
// Single scope
const data = Wire.snapshot('wire_test/profile.html.twig');
console.log(data.user.name);  // "Alice"

// All scopes
const all = Wire.snapshot();
// → [{ scope: 'wire_test/profile.html.twig', data: { user: {...} } }, ...]
```

- Returns `null` for an unknown scope name.
- The returned object is a deep clone — mutations do not affect live data.
- Safe to serialise to JSON and send to the server.

### `Wire.init()`

Parses all scopes in the current document and starts the mutation observer for dynamically added elements. Called automatically on `DOMContentLoaded`. Safe to call again if new scope markup is injected into the page.

## Reactive Proxy

`Wire.get()` returns a recursive `Proxy`. Assigning to any property — at any depth — triggers a DOM update for all bound elements at that path or below.

```js
const proxy = Wire.get(scope);

proxy.user.name = 'Bob';           // updates data-wire="user.name"
proxy.user.address.city = 'Paris'; // updates data-wire="user.address.city"
                                    // and data-wire="user.address"
                                    // and data-wire="user"
```

## Two-way Binding

Elements with `data-wire="path:value"` get an `input` event listener. Typing into the element writes the new value back to the scope proxy, which propagates to all other elements bound to the same path.

```twig
<input data-wire="user.name:value" value="{{ user.name }}">
<h1 data-wire="user.name">{{ user.name }}</h1>
```

Typing in the input updates the `h1` in real time. Setting `proxy.user.name` programmatically also updates the input's value.

## Scope Names

In debug mode (`APP_DEBUG=1`), scope names equal the Twig template path:

```js
Wire.get('wire_test/user.html.twig')
```

In production (`APP_DEBUG=0`), they are 8-character sha256 hex prefixes. To write code that works in both modes, read the scope name from the DOM:

```js
function getScopeName() {
    const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
    let node;

    while ((node = walker.nextNode())) {
        const text = node.textContent.trim();

        if (text.startsWith('wire-scope:')) {
            return text.slice('wire-scope:'.length);
        }
    }

    return null;
}

const proxy = Wire.get(getScopeName());
```

Or use `Wire.snapshot()` (no args) to enumerate all active scope names:

```js
const scopes = Wire.snapshot();
const scopeName = scopes[0].scope;
```

## Cross-scope Updates

When the same PHP object appears in two templates, Wire links them via a shared JS object reference. Mutating the proxy in one scope automatically updates bindings in the other scope.

```js
Wire.get('parent_template.html.twig').user.name = 'Bob';
// → also updates all data-wire="user.name" bindings in child templates
//   that reference the same user object via {$ref}
```
