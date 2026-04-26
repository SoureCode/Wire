# Wire — Twig Integration

## Installation

```bash
composer require sourecode/wire
```

Symfony Flex registers the bundle automatically. For manual registration:

```php
// config/bundles.php
return [
    SoureCode\Wire\Bundle\WireBundle::class => ['all' => true],
];
```

Include the client bundle in your base template:

```html
<script src="/wire.js"></script>
```

## Opt-in

```twig
{% wire %}            {# this template gets a scope #}
{% wire cascade %}    {# this template and all its includes/embeds get a scope #}
```

Place `{% wire %}` anywhere in the template. It is a compile-time marker — placement does not affect output position. The scope comment and JSON bootstrap are injected at the start/end of the template's rendered output.

## Bindings

```twig
<span data-wire="user.name">{{ user.name }}</span>
<input data-wire="user.email:value" value="{{ user.email }}">
<span data-wire="user.status:class">{{ user.status }}</span>
<div data-wire="item.id:data-id">...</div>
```

Format: `data-wire="dot.path"` or `data-wire="dot.path:target"`.

| Target | Behaviour |
|--------|-----------|
| *(omitted)* | Sets `element.textContent` |
| `value` | Sets `element.value`; also enables two-way binding on form controls |
| *(anything else)* | Sets the named HTML attribute via `setAttribute` |

Multiple elements can bind to the same path — all update when the value changes.

## PHP Controller Setup

Call `WireHelper::reset()` once per render to clear cross-scope object identity state:

```php
use SoureCode\Wire\WireHelper;

WireHelper::reset();
return $this->render('page.html.twig', ['user' => $user]);
```

## How It Works

**Compile time** — `WireNodeVisitor` scans `data-wire` values in raw HTML via regex on `TextNode` nodes. For opted-in templates it injects `WireScopeStartNode` / `WireScopeEndNode` into Twig's `display_start` / `display_end` hooks.

**Render time** — `WireHelper::extract()` walks only the bound paths and builds a minimal JSON object from the Twig context. Only paths referenced in `data-wire` attributes are included — the full context is never serialised. PHP object identity is tracked via `spl_object_id()`: the same object appearing in two scopes emits `{"$ref": "scope#path"}` rather than a duplicate.

**Scope IDs** — In debug mode (`APP_DEBUG=1`) the scope ID equals the template name. In production (`APP_DEBUG=0`) it is an 8-character sha256 prefix of the template name, preventing file system path exposure in HTML source.

## Cascade

`{% wire cascade %}` propagates opt-in to child templates:

```twig
{# parent.html.twig #}
{% wire cascade %}
{% include 'child.html.twig' %}
```

- **Includes** — resolved at compile time; cascade propagates immediately.
- **Embeds** — compiled lazily and separately. The embedded template filename is read from `embedded_templates[n]->getNode('parent')` and stored in a static property that the child's compilation picks up.

Note: cascade requires parent and embedded/included template to compile in the same request when the cache is cold.

## WireHelper API Reference

```php
WireHelper::reset(): void
```
Clears cross-scope object identity state. Call once before each render.

```php
WireHelper::extract(array $context, array $paths, string $scope): array
```
Walks `$paths` in `$context` and returns a minimal JSON-serialisable array. Deduplicates PHP objects using `spl_object_id()`.

```php
WireHelper::scopeId(string $templateName, bool $debug): string
```
Returns the scope identifier. Debug mode: `$templateName`. Production: `substr(hash('sha256', $templateName), 0, 8)`.
