# Wire — Architecture

## File Structure

```
src/                              # PHP (Symfony bundle)
  Attribute/
    Wire.php                      # #[Wire(submit: 'route_name')]
  Serializer/
    WireIdentityNormalizer.php    # tags Doctrine-managed objects when the
                                  # framework serializer is invoked elsewhere
  Bundle/
    WireBundle.php                # bundle entry point
    DependencyInjection/
      WireExtension.php           # container extension
  WireExtension.php               # Twig extension — node visitor + token parser
  WireTokenParser.php             # parses {% wire %} / cascade / groups=[…]
  WireOptInNode.php               # compile-time marker node
  WireBindingExtractor.php        # classifies a print expression →
                                  #   {p, f?} | {parts:[…]} | null (frozen)
  WireHtmlScanner.php             # text/tag/attr state machine
  WireAttrInjector.php            # inject wire:<attr>='JSON' on tags
  WireNodeVisitor.php             # AST visitor — collects paths, wraps prints,
                                  # injects scope start/end + attribute markers
  WireScopeStartNode.php          # compiled call to WireRuntime::renderScope
  WireScopeEndNode.php            # closing scope marker
  WireIdentityResolver.php        # builds __class / __id / __submit tags
  WireRuntime.php                 # path-walk extraction + group additive layer
                                  # + intra/cross-scope $ref dedup
  WireHelper.php                  # scope-id hashing

assets/
  wire.js                         # init(), getScope(), submit()
  src/
    bindings.js                   # evaluateBinding(), applyBinding(),
                                  # updateScopeBindings(), updateBindings()
    dom.js                        # parseScopes(), MutationObserver,
                                  # two-way input listener
    filters.js                    # FILTERS registry + applyFilters()
    identity.js                   # unifyByIdentity(), stripIdentityTags()
    path.js                       # resolvePath(), extractPaths()
    proxy.js                      # makeProxy() + per-proxy methods
    refs.js                       # resolveRefs(), buildRefMap(),
                                  # buildCrossScopeRefs()
    scope.js                      # Scope class, registry, createScope(),
                                  # findScopeFor(), createScopeHandle()
    types.js                      # JSDoc typedefs
    utils/
      deepClone.js
      isPlainObject.js
```

## Two Axes: Scope and Identity

- **Scope** — a template render boundary. Groups the bindings produced by one render of a template, marked by a comment pair around the rendered HTML. Scope ID derives from the template path (debug) or its sha256 prefix (prod). Scope is internal plumbing; user code never speaks the scope identifier.
- **Identity** — `(class, id)` per Doctrine-managed object. Travels with each entity wherever it appears.

Variable names (the names the developer wrote in Twig — `user`, `post`, `cart`) are the public handles the JS API exposes via `scope.get(name)`.

## What the Server Emits

```html
<!-- wire-scope:wire_test/user.html.twig -->
<script type="wire">{"user":{"__class":"App\\Entity\\User","__id":42,"__submit":{"url":"/api/user/42/save","method":"PUT"},"name":"Alice","email":"…"}}</script>
…
<h1><!--w:{"p":"user.name"}-->Alice<!--/w--></h1>
<input value="Alice" wire:value='{"p":"user.name"}'>
<a class="card-active" wire:class='{"parts":[{"l":"card-"},{"p":"user.status"}]}'>…</a>
…
<!-- /wire-scope:wire_test/user.html.twig -->
```

In production both the scope identifier and `__class` are 8-character sha256 prefixes.

## Compile-time Flow

```
Twig compile
  └─ WireNodeVisitor::leaveNode()
       ├─ For every PrintNode:
       │    └─ collectPaths(expr) → adds dot-paths to templatePaths
       │       (recurses into filters/concat/whatever; even frozen
       │        expressions contribute paths for tracking)
       ├─ For every WireOptInNode (from {% wire %}):
       │    └─ records opt-in + cascade flag + groups
       └─ On ModuleNode exit, if opted-in and any paths were collected:
            ├─ wrapTextContentPrints(module)
            │     For each text-content PrintNode where
            │     WireBindingExtractor::extract() returns non-null:
            │     replace with Nodes(<!--w:JSON-->, PrintNode, <!--/w-->)
            ├─ WireAttrInjector::process(module)
            │     For each tag attribute that contains one or more
            │     {{ … }} prints whose bindings all extract cleanly:
            │     inject ` wire:<attr>='<json>'` after the closing quote
            ├─ Inject WireScopeStartNode → display_start
            └─ Inject WireScopeEndNode   → display_end
```

`WireBindingExtractor::extract()` recognises:

| Source expression | Descriptor |
|---|---|
| `user.name` | `{ "p": "user.name" }` |
| `user.name\|upper\|trim` | `{ "p": "user.name", "f": [["upper"], ["trim"]] }` |
| `user.name ~ ' (' ~ user.role ~ ')'` | `{ "parts": [{"p":"user.name"}, {"l":" ("}, {"p":"user.role"}, {"l":")"}] }` |
| Anything else | `null` (frozen — path still tracked, no marker) |

Twig's auto-injected `escape` filter is recognised and dropped from the chain (the client already escapes via `textContent` / `setAttribute`).

## Render-time Flow

```
Twig render
  └─ WireScopeStartNode::compile() emits:
       WireRuntime::renderScope($context, $paths, $scopeId, $groups)
            ├─ For each path:
            │     walk dot-segments against $context via PropertyAccessor
            │     - intermediate object with Doctrine identity → tag with
            │       __class/__id/__submit; mark seen via spl_object_id
            │     - object seen before at a different path → emit
            │       {"$ref": "scope#first-path"} and stop
            │     - same object same path on a second walk → continue
            │     - leaf scalar → assign
            ├─ if $groups non-empty:
            │     additive Symfony Serializer pass per top-level
            │     entity root with the configured groups context;
            │     fills in fields not already present
            └─ Emit <!-- wire-scope:ID --> <script type="wire">JSON</script>
```

`__submit` is built by `WireIdentityResolver`:

- Method = first declared HTTP method on the `#[Wire(submit:)]` route, defaulting to `POST`.
- URL = `Router::generate(routeName, $idValues)` so `{id}` placeholders fill from the entity's identifiers.

`WireIdentityNormalizer` only fires when the framework serializer is invoked outside the runtime path-walk — e.g. for the `{% wire groups=[…] %}` augmentation, or when application code serializes entities through the same chain.

## Client-side Flow

```
DOMContentLoaded
  └─ Wire.init()
       └─ parseScopes()
            ├─ TreeWalker pass over comments + elements:
            │    - <!-- wire-scope:* --> push/pop scope drafts
            │    - <!--w:JSON--> push, <!--/w--> pop → ensure a single
            │      Text-node placeholder between the markers, register
            │      a {kind:'text', node, descriptor} binding
            │    - <script type="wire"> → parse scope JSON
            │    - element wire:* attribute → register
            │      {kind:'attr', node, attr, descriptor} binding
            ├─ resolveRefs()   — substitute {$ref} placeholders with
            │                    live objects
            ├─ unifyByIdentity() — collapse same __class/__id objects
            │                      to one canonical JS instance
            ├─ buildRefMap()   — intra-scope alias map
            ├─ buildCrossScopeRefs() — cross-scope aliases (uses the
            │                    JS object identity established above)
            ├─ createScope()   — Scope class wraps data with a recursive
            │                    Proxy and a public ScopeHandle
            └─ For every binding:
                 - attach two-way listener if wire:value on a form
                   control with a pure-path descriptor
                 - applyBinding(binding, scope.data) — initial render
       └─ MutationObserver(document) → registerSubtree(addedNode):
            scan added subtree for new wire:* attrs and <!--w:…-->
            marker pairs, register, apply initial value
```

## Binding Apply

```
applyBinding(binding, data)
  └─ value = evaluateBinding(binding.descriptor, data)
       - { p } / { p, f } → resolvePath + applyFilters
       - { parts: […] }   → concatenate literals + path values
  ├─ kind 'text' →
  │    - if descriptor.f contains 'raw' → write innerHTML on parent
  │      via document.createRange().createContextualFragment(value)
  │    - else → binding.node.nodeValue = String(value ?? '')
  └─ kind 'attr' →
       - attr === 'value' on form control → element.value = value
       - attr === 'innerHTML'              → element.innerHTML = value
       - boolean attr (hidden/disabled/…)  → set/remove
       - otherwise                         → setAttribute(attr, value)
```

## Proxy / Binding Update

```
proxy.set(key, value)
  └─ updateBindings(scope, fullPath)
       ├─ updateScopeBindings(scope, fullPath)
       │    For each binding whose `paths` include any of:
       │      path === fullPath
       │      path.startsWith(fullPath + '.')
       │      fullPath.startsWith(path + '.')
       │    → applyBinding(binding, scope.data)
       └─ For each refMap entry matching fullPath:
            - compute alias path with the same suffix
            - updateScopeBindings(aliasScope, aliasedPath)
```

## Cross-Scope Dedup

Two layers, both alive:

1. **Server `$ref` (top-level only)** — the same object instance walked through two scopes' paths during one render emits `{"$ref": "scope1#user"}` for the second occurrence. `resolveRefs` swaps it for the live object client-side.
2. **Client identity-unify (everywhere)** — after `$ref` resolution, every object carrying `__class`+`__id` is collapsed to a single canonical JS instance. Fields from later occurrences fill gaps. `buildCrossScopeRefs` (`WeakMap` keyed by JS object identity) then wires cross-scope aliases automatically.

## Submit Round-trip

```
Wire.submit(value, options?)
  ├─ Read value.__submit.{url, method}
  ├─ stripIdentityTags(deepClone(value)) — drop __class/__id/__submit
  └─ fetch(options.url ?? __submit.url, {
         method: options.method ?? __submit.method,
         headers: { 'Content-Type': 'application/json', …options.headers },
         body: JSON.stringify(payload),
         …rest of options
     })
```

## Scope ID Security

In debug mode (`APP_DEBUG=1`), scope IDs and `__class` values equal the template path / FQCN. In production they are 8-character lowercase hex strings derived from sha256, preventing leaks of file system paths and class names in production HTML.
