# Wire Identity

## Goal

Wire needs an identity the server understands.

Wire must not expose PHP class names, PHP FQCNs, or class-derived public API names to the browser.

The client addresses objects through Twig variables and generic JavaScript proxies.

## Shape

Use a split identity object:

```json
{
  "user": {
    "__wire": {
      "type": "u7f31a9c",
      "id": 42
    },
    "name": "Alice"
  }
}
```

## Semantics

`__wire.type` is an opaque server-issued type token.

`__wire.id` is the server-side object identifier.

The browser may inspect and echo both values.

The browser must not construct `type`.

The browser must not infer PHP class names from `type`.

The server resolves `type` to the internal handler, metadata, repository, or class it needs.

The server rejects unknown `type` values.

## Client Registry

The client registry keys entities by `__wire.type` and `__wire.id`.

Current identity key:

```js
`${__class}#${JSON.stringify(__id)}`
```

Target identity key:

```js
`${__wire.type}#${JSON.stringify(__wire.id)}`
```

## Public Handle

Twig variable names remain the public handle:

```js
const user = Wire.getScope(element).get('user');
```

The client works with `user` as a generic proxy.

The client does not request objects by PHP class name.

The client does not request objects by `type` directly unless the server emitted that token first.

## Scope

Nested managed objects use the same `__wire` shape.

Plain objects and value objects do not need `__wire`.

This document only defines identity shape and client/server responsibility.

It does not define repositories, routing, create/delete behavior, serializer groups, or error handling.
