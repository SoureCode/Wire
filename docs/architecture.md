# Wire — Architecture

## Files

```
src/
  wire.js                # client runtime
  WireExtension.php      # Twig extension
  WireNodeVisitor.php    # compile-time AST visitor
  WireTokenParser.php    # {% wire %} / {% wire cascade %}
  WireOptInNode.php      # marker node
  WireScopeStartNode.php # renders scope open + JSON bootstrap
  WireScopeEndNode.php   # renders scope close
  WireHelper.php         # path serialization + object identity
```

## Scopes

```html
<!-- wire-scope:profile.html.twig -->
<script type="wire">{"user":{"name":"Jason"}}</script>
...
<!-- /wire-scope:profile.html.twig -->
```

One scope per opted-in template. Only paths referenced in `data-wire` are serialized.

## Flow

1. **Compile** — `WireNodeVisitor` scans `data-wire` values in the AST and injects scope nodes into Twig's `display_start`/`display_end` hooks.
2. **Render** — `WireHelper::extract()` walks only the bound paths and builds minimal JSON. Same PHP object in two scopes → `{"$ref": "scope#path"}` instead of a copy.
3. **Client** — `wire.js` parses scopes, builds recursive Proxies, registers bindings.

## Cross-Scope Refs

Same PHP object in multiple templates → detected via `spl_object_id()`. Child template gets `{"$ref": "parent#path"}`. JS resolves it to the same object — mutations propagate across scopes.

## JS API

```js
Wire.get(name)         // first proxy for that template
Wire.get(name, index)  // nth proxy (loop templates)
Wire.getAll(name)      // all proxies for that template
Wire.snapshot(name)    // deep-clone of scope data, refs resolved
Wire.snapshot()        // [{scope, data}] for all scopes
```

## Limitations

- No client-side rendering — `push()` does not add DOM rows.
- Cascade embed requires parent and embedded template to compile in the same request.
