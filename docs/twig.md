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
| `innerHTML` | Sets `element.innerHTML` — use only with trusted data |
| `hidden`, `disabled`, `readonly`, `required`, `checked`, … | Boolean attribute — sets (truthy value) or removes (falsy value) the attribute |
| *(anything else)* | Sets the named HTML attribute via `setAttribute` |

Multiple elements can bind to the same path — all update when the value changes.

## Entity Identity & Submit

Doctrine-managed entities are tagged with their class FQCN and identifier so the client can de-duplicate them and post them back:

```php
use SoureCode\Wire\Attribute\Wire;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity]
#[Wire(submit: 'app_user_save')]
class User
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    public int $id;

    #[ORM\Column]
    #[Groups(['wire'])]
    public string $name;
    // ...
}
```

- `#[Wire(submit: 'route_name')]` declares the round-trip target. The route's first declared HTTP method becomes the request method (`POST` if the route accepts any). Identifier values are passed as route parameters, so `{id}` placeholders resolve naturally.
- `#[Groups(['wire'])]` decides which fields are exposed. Properties without the group are skipped. `#[Ignore]` works as well.

The emitted JSON for an entity carries identity metadata alongside the fields:

```json
{
    "user": {
        "__class": "App\\Entity\\User",
        "__id": 42,
        "__submit": { "url": "/api/user/42/save", "method": "PUT" },
        "name": "Alice",
        "email": "alice@example.com"
    }
}
```

In production (`APP_DEBUG=0`) `__class` is replaced with an 8-character sha256 prefix to avoid leaking class names.

Plain arrays, DTOs and other non-entity values pass through unchanged — no identity tag, no `Wire.submit()` support.

## How It Works

**Compile time** — `WireNodeVisitor` scans `data-wire` values in raw HTML via regex on `TextNode` nodes and collects the *root* variable names referenced (`user`, `cart`, …). For opted-in templates it injects `WireScopeStartNode` / `WireScopeEndNode` into Twig's `display_start` / `display_end` hooks.

**Render time** — `WireRuntime` (a Twig runtime) takes the bound roots, hands each value to the Symfony Serializer, and emits the JSON bootstrap. The chain includes `WireIdentityNormalizer`, which prepends `__class` / `__id` / `__submit` to every Doctrine-managed object it sees. Top-level cross-scope dedup uses `spl_object_id()`: the same instance referenced as a root in two scopes during one render becomes `{"$ref": "scope#path"}` in the second occurrence. Nested same-entity dedup happens client-side via `__class`+`__id` identity.

**Scope IDs** — In debug mode (`APP_DEBUG=1`) the scope ID equals the template name. In production (`APP_DEBUG=0`) it is an 8-character sha256 prefix of the template name.

## Cascade

`{% wire cascade %}` propagates opt-in to child templates:

```twig
{# parent.html.twig #}
{% wire cascade %}
{% include 'child.html.twig' %}
```

- **Includes** — resolved at compile time; cascade propagates immediately.
- **Embeds** — compiled lazily and separately. The embedded template filename is read from `embedded_templates[n]->getNode('parent')` and stored in a static property that the child's compilation picks up.

Cascade requires parent and embedded/included template to compile in the same request when the cache is cold.

## API Reference

```php
WireHelper::scopeId(string $templateName, bool $debug): string
```
Returns the scope identifier. Debug mode: `$templateName`. Production: `substr(hash('sha256', $templateName), 0, 8)`.

```php
WireHelper::reset(): void
```
Resets cascade-tracking state held in `WireNodeVisitor`. Used internally by tests; not normally needed at runtime.

```php
SoureCode\Wire\Attribute\Wire(?string $submit = null)
```
Class-level attribute. `submit` is a Symfony route name; the bundle resolves the route to a URL and reads its declared methods at render time.
