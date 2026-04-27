# Wire Global Payload

## Goal

Wire should emit one global JSON payload for the page.

The server should merge entity usage across rendered Wire scopes.

Each scope should keep its own Twig variable handles.

## Current Shape

The current implementation emits one `<script type="wire">` payload per scope.

Each scope owns its own data tree.

The client later resolves `$ref` values and unifies repeated entities by identity.

## Target Shape

Emit one page-level payload:

```json
{
  "entities": {
    "u7f31a9c:42": {
      "__wire": {
        "type": "u7f31a9c",
        "id": 42
      },
      "name": "Alice",
      "email": "alice@example.com"
    }
  },
  "scopes": {
    "8b1f2c9a": {
      "handles": {
        "user": "u7f31a9c:42"
      }
    },
    "31e0a7d4": {
      "handles": {
        "profile": "u7f31a9c:42"
      }
    }
  }
}
```

## Server-Side Merge

The server collects rendered Twig usage from every Wire scope on the page.

The server resolves each used object to its `__wire` identity.

The server merges all used paths for the same identity into one entity payload.

If one scope uses `user.name` and another scope uses `profile.email`, the emitted entity contains both `name` and `email`.

The server emits the entity once.

## Scope Handles

Scopes do not duplicate entity data.

Scope keys use the same scope id that appears in the DOM boundary comments.

In production, scope ids are opaque hashes.

In debug, scope ids may be template names for readability.

Scopes map Twig variable names to entity keys.

The same entity may have different handles in different scopes.

Example:

```json
{
  "scopes": {
    "a": {
      "handles": {
        "user": "u7f31a9c:42"
      }
    },
    "b": {
      "handles": {
        "author": "u7f31a9c:42"
      }
    }
  }
}
```

Both handles point to the same client proxy.

The public API stays scope-local:

```js
const user = Wire.getScope(element).get('user');
```

## Conditional Rendering

Only rendered usage contributes to the global payload.

Fields mentioned only in branches that did not render are not emitted.

## Client Responsibility

The client builds one proxy per entity payload.

Each scope handle returns the proxy referenced by that scope.

Bindings remain scope-local because DOM markers live inside a scope.

Entity state is global because repeated handles share one proxy.

## Scope

This document defines payload layout and handle behavior.

It depends on split opaque identity from `docs/plan/wire-identity.md`.

It does not define repositories, routes, create/delete behavior, serializer groups, or error handling.
