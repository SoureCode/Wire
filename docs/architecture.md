# Wire — Architecture

## File Structure

```
src/                          # PHP (Symfony bundle)
  WireBundle.php              # bundle entry point
  WireExtension.php           # Twig extension — registers node visitor + token parser
  WireTokenParser.php         # parses {% wire %} / {% wire cascade %}
  WireOptInNode.php           # compile-time marker node
  WireNodeVisitor.php         # AST visitor — collects bindings, injects scope nodes
  WireScopeStartNode.php      # emits scope open comment + JSON bootstrap script
  WireScopeEndNode.php        # emits scope close comment
  WireHelper.php              # path serialization, object identity, scope ID hashing
  Bundle/
    DependencyInjection/
      WireExtension.php       # container extension

assets/
  wire.js                     # JS entry point — init(), get(), getAll(), snapshot()
  src/
    bindings.js               # applyBinding(), updateScopeBindings(), updateBindings()
    dom.js                    # parseScopes(), setupTwoWay(), setupMutationObserver()
    path.js                   # resolvePath() — dot-path lookup in plain objects
    proxy.js                  # makeProxy() — recursive Proxy for reactive data
    refs.js                   # resolveRefs(), buildRefMap(), buildCrossScopeRefs()
    snapshot.js               # snapshot() — deep-clone of live scope data
    types.js                  # JSDoc typedefs
    utils/
      deepClone.js            # deep clone with circular reference protection
      isPlainObject.js        # type guard for plain objects
```

## Scopes

Each opted-in template produces one scope on the rendered page:

```html
<!-- wire-scope:wire_test/user.html.twig -->   ← debug mode: template name
<script type="wire">{"user":{"name":"Jason","email":"..."}}</script>
<h1 data-wire="user.name">Jason</h1>
...
<!-- /wire-scope:wire_test/user.html.twig -->
```

In production (`APP_DEBUG=0`) the scope identifier is a sha256 prefix:

```html
<!-- wire-scope:a3f2b1c4 -->
```

`WireHelper::scopeId(string $templateName, bool $debug): string` controls this:
- Debug: returns `$templateName`
- Prod: returns `substr(hash('sha256', $templateName), 0, 8)`

Only paths actually referenced in `data-wire` attributes are serialized into the JSON bootstrap. Paths are extracted at Twig compile time by `WireNodeVisitor`.

## Compile-time Flow

```
Twig compile
  └─ WireNodeVisitor::leaveNode()
       ├─ Collects data-wire paths from TextNode regex
       ├─ Records {% wire %} / {% wire cascade %} opt-ins
       └─ On ModuleNode exit:
            ├─ Injects WireScopeStartNode → display_start
            └─ Injects WireScopeEndNode   → display_end
```

## Render-time Flow

```
Twig render
  └─ WireScopeStartNode::compile() output
       ├─ Calls WireHelper::extract($context, $paths, $scopeId)
       │    └─ Walks bound paths only
       │         ├─ Scalar → stored as-is
       │         ├─ Object seen before in same scope → {"$ref": "path"}
       │         └─ Object seen in another scope → {"$ref": "scope#path"}
       ├─ Emits <!-- wire-scope:ID -->
       └─ Emits <script type="wire">JSON</script>
```

## Client-side Flow

```
DOMContentLoaded
  └─ Wire.init()
       └─ parseScopes(scopes)
            ├─ TreeWalker finds <!-- wire-scope:* --> comment pairs
            ├─ Parses <script type="wire"> JSON into scope.data
            ├─ Collects [element, path, target] bindings from data-wire
            ├─ resolveRefs() — replaces {$ref} placeholders with live objects
            ├─ buildRefMap() — intra-scope alias map
            ├─ buildCrossScopeRefs() — cross-scope alias map
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

## Cross-Scope Refs

Same PHP object in multiple templates → detected via `spl_object_id()`. Child template gets `{"$ref": "parentScope#path"}`. On the client:

1. `resolveRefs()` replaces `{$ref}` objects with the actual live reference
2. `buildCrossScopeRefs()` populates `scope.refMap` so proxy mutations propagate across scope boundaries

## Scope ID Security

In debug mode, scope IDs equal the template path (`wire_test/user.html.twig`). In production, they are 8-character lowercase hex strings derived from sha256 of the template name. This prevents leaking file system paths in production HTML.
