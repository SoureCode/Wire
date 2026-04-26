# Future: Wire.on() — Proxy Change Callbacks

## Problem

There is currently no way to react to data changes from JavaScript without polling `Wire.snapshot()`. If you want to, for example, send a network request when a field changes, you must add an `input` event listener manually — which bypasses Wire's change tracking and only catches user input, not programmatic mutations.

## Proposed API

```js
Wire.on(scopeName, path, callback)
```

Registers a callback that fires whenever the value at `path` (or any path below it) changes in the named scope.

```js
Wire.on('wire_test/user.html.twig', 'user.name', (newValue, oldValue, path) => {
    console.log('name changed:', oldValue, '→', newValue);
});

Wire.on('wire_test/user.html.twig', 'user', (newValue) => {
    // fires for any change under user.*
    fetch('/api/save', { method: 'POST', body: JSON.stringify(newValue) });
});
```

Returns an unsubscribe function:

```js
const off = Wire.on(scope, 'user.name', handler);
off(); // remove the listener
```

## Semantics

- `path` uses the same dot-path rules as `data-wire`.
- Callback fires for changes at `path` and any sub-path (same rule as bindings).
- Callback receives `(newValue, oldValue, changedPath)`.
- Listeners survive `Wire.init()` re-calls but are cleared on page navigation.
- Cross-scope propagation fires listeners in all affected scopes.
- `oldValue` is a deep clone of the previous value (to avoid aliasing).

## Implementation Sketch

- Add a `listeners: Map<string, Set<Function>>` to each `Scope`.
- In `updateBindings()`, after updating DOM bindings, walk `scope.listeners` and fire matching entries.
- `Wire.on()` looks up the scope (same as `Wire.get()`), pushes to `scope.listeners`.
- Return a closure that deletes the entry.

## Open Questions

- Should multiple scopes with the same name each fire the callback independently, or aggregate?
- Should `Wire.on()` accept an index like `Wire.get(name, index)`?
- Should there be a `Wire.once()` variant?
