# Wire — Architecture

## File Structure

```
src/                          # PHP (Symfony bundle)
  Attribute/
    Wire.php                  # #[Wire(submit: 'route_name')]
  Serializer/
    WireIdentityNormalizer.php  # tags Doctrine-managed objects with __class/__id/__submit
  WireBundle.php              # bundle entry point (Bundle/WireBundle.php)
  WireExtension.php           # Twig extension — registers node visitor + token parser
  WireTokenParser.php         # parses {% wire %} / {% wire cascade %}
  WireOptInNode.php           # compile-time marker node
  WireNodeVisitor.php         # AST visitor — collects bindings, injects scope nodes
  WireScopeStartNode.php      # compiled call to WireRuntime::renderScope
  WireScopeEndNode.php        # closing scope marker
  WireRuntime.php             # Twig runtime — orchestrates serialization + top-level $ref dedup
  WireHelper.php              # scope ID hashing
  Bundle/
    DependencyInjection/
      WireExtension.php       # container extension — registers runtime + identity normalizer

assets/
  wire.js                     # JS entry point — init(), get(), getAll(), snapshot(), submit()
  src/
    bindings.js               # applyBinding(), updateScopeBindings(), updateBindings()
    dom.js                    # parseScopes(), setupTwoWay(), setupMutationObserver()
    identity.js               # unifyByIdentity(), stripIdentityTags()
    path.js                   # resolvePath()
    proxy.js                  # makeProxy()
    refs.js                   # resolveRefs(), buildRefMap(), buildCrossScopeRefs()
    snapshot.js               # snapshot()
    types.js                  # JSDoc typedefs
    utils/
      deepClone.js
      isPlainObject.js
```

## Two Axes: Scope and Identity

- **Scope** — a template render boundary. Groups the bindings produced by one render of a template, marked by a comment pair around the rendered HTML. Scope ID derives from the template path (debug) or its sha256 prefix (prod).
- **Identity** — `(class, id)` per Doctrine-managed object. Travels with each entity wherever it appears.

Scope answers "which template render is this?". Identity answers "what is this thing?" (used for submit and cross-scope dedup). Plain arrays / DTOs have no identity and pass through unchanged.

## Scopes

Each opted-in template produces one scope on the rendered page:

```html
<!-- wire-scope:wire_test/user.html.twig -->
<script type="wire">{"user":{"__class":"App\\Entity\\User","__id":42,"__submit":{"url":"/api/user/42/save","method":"PUT"},"name":"Alice","email":"..."}}</script>
<h1 data-wire="user.name">Alice</h1>
...
<!-- /wire-scope:wire_test/user.html.twig -->
```

In production the scope identifier and `__class` are sha256 prefixes:

```html
<!-- wire-scope:a3f2b1c4 -->
<script type="wire">{"user":{"__class":"7e91d2f0","__id":42,...}}</script>
```

## Compile-time Flow

```
Twig compile
  └─ WireNodeVisitor::leaveNode()
       ├─ Collects root variable names from data-wire attributes (regex on TextNode)
       ├─ Records {% wire %} / {% wire cascade %} opt-ins
       └─ On ModuleNode exit:
            ├─ Injects WireScopeStartNode → display_start
            └─ Injects WireScopeEndNode   → display_end
```

## Render-time Flow

```
Twig render
  └─ WireScopeStartNode::compile() emits a call to:
       WireRuntime::renderScope($context, $rootNames, $scopeId)
            └─ For each root in $rootNames:
                 ├─ scalar/array → recurse, dedup by spl_object_id where applicable
                 ├─ object seen before in this render → {"$ref": "scope#path"}
                 └─ object not seen → mark seen, hand to Symfony Serializer
       Symfony Serializer chain
            └─ WireIdentityNormalizer (priority 100)
                 ├─ supports() returns true for non-stdClass objects with Doctrine identity
                 ├─ Tracks per-object spl_object_id to avoid recursing into itself
                 ├─ Delegates field walk to the next normalizer (ObjectNormalizer)
                 └─ Prepends { __class, __id, __submit? } to the result
       └─ Emits <!-- wire-scope:ID --><script type="wire">JSON</script>
```

`__submit` is built from `#[Wire(submit: 'route_name')]`:

- Method = first declared HTTP method on the route, defaulting to `POST`.
- URL = `Router::generate(routeName, $idValues)` so route placeholders resolve from the entity's identifiers.

## Client-side Flow

```
DOMContentLoaded
  └─ Wire.init()
       └─ parseScopes(scopes)
            ├─ TreeWalker finds <!-- wire-scope:* --> comment pairs
            ├─ Parses <script type="wire"> JSON into scope.data
            ├─ Collects [element, path, target] bindings from data-wire
            ├─ resolveRefs() — replaces {$ref} placeholders with live objects
            ├─ unifyByIdentity() — collapses same (__class, __id) objects to one canonical JS instance
            ├─ buildRefMap() — intra-scope alias map
            ├─ buildCrossScopeRefs() — cross-scope alias map (now picks up identity-unified objects)
            ├─ makeProxy(scope.data, scope) — wraps data in recursive Proxy
            ├─ applyBinding() — applies all bindings to DOM on init
            └─ setupTwoWay() — attaches input event listeners
```

## Proxy / Binding Update Flow

```
proxy.set(key, value)
  └─ updateBindings(scope, fullPath)
       ├─ updateScopeBindings(scope, fullPath)
       │    └─ For each binding where path === fullPath or starts with fullPath:
       │         └─ applyBinding(element, target, resolvePath(data, path))
       └─ For each refMap entry matching fullPath:
            └─ updateScopeBindings(aliasScope, aliasedPath)
```

## Cross-Scope Dedup

Two layers, both alive:

1. **Server `$ref` (top-level only)** — the same object instance referenced as a root in two scopes during one render: the second scope emits `{"$ref": "scope1#user"}`. `resolveRefs` swaps it for the live object client-side.
2. **Client identity-unify (everywhere)** — after `$ref` resolution, every object carrying `__class`+`__id` is collapsed to a single canonical JS instance. Fields from later occurrences fill gaps in the canonical one. Existing `buildCrossScopeRefs` (a `WeakMap` keyed by JS object identity) then wires the cross-scope refMap automatically.

## Submit Round-trip

```
Wire.submit(value)
  ├─ Reads value.__submit.{url, method}
  ├─ stripIdentityTags(deepClone(value)) — removes __class/__id/__submit
  └─ fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(...) })
```

`options.url`, `options.method`, `options.headers` (and any other `RequestInit` field) override or merge with the defaults.

## Scope ID Security

In debug mode, scope IDs and `__class` values equal the template path / FQCN. In production they are 8-character lowercase hex strings derived from sha256, preventing leaks of file system paths and class names in production HTML.
