# Wire — Twig Integration

## Opt-in

```twig
{% wire %}            {# this template gets a scope #}
{% wire cascade %}    {# this template and all its includes/embeds get a scope #}
```

## Bindings

```twig
<span data-wire="user.name">{{ user.name }}</span>
<input data-wire="user.email:value" value="{{ user.email }}">
<span data-wire="user.status:class">{{ user.status }}</span>
```

Format: `data-wire="dot.path"` (defaults to text content) or `data-wire="dot.path:target"`.

## Registration

```php
$twig->addExtension(new \Wire\WireExtension());
\Wire\WireHelper::reset(); // once per render
echo $twig->render('page.html.twig', $context);
```

## How It Works

**Compile time** — `WireNodeVisitor` finds `data-wire` values in raw HTML via regex on `TextNode`. For opted-in templates it injects `WireScopeStartNode`/`WireScopeEndNode` into Twig's `display_start`/`display_end` hooks.

**Render time** — `WireHelper::extract()` walks only the bound paths and builds a minimal JSON object from the Twig context. It tracks PHP object identity across scopes (`spl_object_id`) and emits `{"$ref": "scope#path"}` when the same object appears in multiple templates.

## Cascade

`{% wire cascade %}` propagates opt-in to child templates:

- **Includes** compile in the same parse as the parent — cascade is resolved at compile time.
- **Embeds** compile lazily and separately. The embedded template filename is read from `embedded_templates[n]->getNode('parent')` and stored in a static property that the child's compilation picks up.
