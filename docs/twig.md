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
{% wire %}                              {# this template gets a scope #}
{% wire cascade %}                      {# scope cascades to includes/embeds #}
{% wire groups=['admin'] %}             {# additionally serialize fields in named groups #}
{% wire cascade groups=['admin'] %}     {# both #}
```

`{% wire %}` is a compile-time marker — placement does not affect output position. The scope comment and JSON bootstrap are injected at the start/end of the template's rendered output.

## Bindings

There is no binding attribute to write. **Every `{{ x.y.z }}` Twig print** is auto-detected at compile time:

```twig
<h1>{{ user.name }}</h1>                          {# text content — reactive #}
<input value="{{ user.email }}">                  {# attribute — reactive, two-way for form controls #}
<a class="card-{{ user.status }}">…</a>           {# implicit literal+path concat — reactive #}
<span>Hello, {{ user.name }}!</span>              {# surrounding literals preserved verbatim #}
<a href="/user/{{ user.id }}/{{ user.slug }}">…</a>  {# multiple prints in one attribute — reactive #}
```

Two-way binding turns on automatically for `value="{{ x.y }}"` on form controls (`<input>`, `<textarea>`, `<select>`).

### Filters

Filters from a small whitelist are replayed on the client when the underlying value changes:

```twig
<span>{{ user.name|upper|trim }}</span>
<span>{{ user.tags|length }}</span>
<a class="{{ user.status|default('inactive') }}">…</a>
```

Currently replayable: `upper`, `lower`, `trim`, `capitalize`, `length`, `abs`, `default`, `nl2br`, `escape`/`e` (no-op — text bindings auto-escape), `raw` (switches text to `innerHTML`).

### Frozen expressions

Anything Wire's compile-time extractor doesn't recognise is **frozen**: rendered once at server side, not updated client-side on path changes. The path itself is still tracked and serialized so the data is available to other bindings or `Wire.submit()`.

```twig
{{ user.name|reverse }}                 {# unsupported filter — frozen #}
{{ a.x ? a.y : a.z }}                  {# ternary — frozen #}
{{ format(user) }}                      {# function call — frozen #}
<a class="x-{{ user.id|reverse }}">…    {# attr with frozen filter — whole attr is frozen #}
```

Forms of expression that ARE replayable: a name, a name with dot-chain accessors, those wrapped in whitelisted filters, and `~`-concatenation of literals plus those.

### Multiple elements, same path

Multiple prints of the same path produce independent markers. Mutating the path updates every binding.

## Entity Identity & Submit

Doctrine-managed entities are tagged with class FQCN and identifier so the client can de-duplicate them and post them back:

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

- `#[Wire(submit: 'route_name')]` declares the round-trip target. The route's first declared HTTP method becomes the request method (`POST` if the route accepts any). Identifier values are passed as route params, so `/user/{id}/save` placeholders resolve naturally.
- `#[Groups(['wire'])]` is **only** consulted for fields the template did NOT bind. Properties Twig already prints are exposed regardless of `#[Groups]` / `#[Ignore]`.

What the runtime emits per scope:

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

In production (`APP_DEBUG=0`) both the scope ID and `__class` are 8-character sha256 prefixes to avoid leaking template paths and class names.

## Cascade

`{% wire cascade %}` propagates opt-in to child templates:

```twig
{# parent.html.twig #}
{% wire cascade %}
{% include 'child.html.twig' %}
```

- **Includes** — resolved at compile time; cascade propagates immediately.
- **Embeds** — compiled lazily and separately; embedded template filenames are tracked in a static property that the child's compilation picks up.

Cascade requires parent and embedded/included template to compile in the same request when the cache is cold.

## How It Works

**Compile time** — `WireNodeVisitor` walks the AST in document order. For each `{{ … }}` print it tries to classify the expression via `WireBindingExtractor`:

| Expression | Result |
|------------|--------|
| `user.name` | `{ "p": "user.name" }` |
| `user.name\|upper\|trim` | `{ "p": "user.name", "f": [["upper"], ["trim"]] }` |
| `user.name ~ ' (' ~ user.role ~ ')'` | `{ "parts": [{"p":"user.name"},{"l":" ("},{"p":"user.role"},{"l":")"}] }` |
| Anything else (path still extracted as a tracking-only path) | `null` (frozen) |

A small HTML state machine (`WireHtmlScanner` / `WireAttrInjector`) decides whether each print is in **text** or **attribute** context:

- **Text** prints get wrapped in `<!--w:JSON-->...<!--/w-->` comment markers around the rendered value. Surrounding literal text is left alone.
- **Attribute** prints — for any tag attribute that contains one or more prints — get a sibling `wire:<attr>='JSON'` injected after the closing quote.

Frozen prints emit no marker; they render normally.

**Render time** — `WireRuntime` (a Twig runtime) walks every dot-path the visitor collected, fetches the value via `PropertyAccessor`, and emits the scope JSON. Doctrine-managed objects are tagged with `__class`/`__id`/`__submit` via `WireIdentityResolver`. Cross-scope `$ref` dedup uses `spl_object_id()` for top-level roots; nested same-entity dedup happens client-side from the identity tags.

`{% wire groups=[…] %}` adds an additive Symfony Serializer pass per top-level entity root to fill in fields not already present from the path-walk.

## API Reference

```php
SoureCode\Wire\Attribute\Wire(?string $submit = null)
```
Class-level attribute. `submit` is a Symfony route name; the bundle resolves it to a URL and reads its declared methods at render time. Route placeholders receive the entity's identifier values.

```php
WireHelper::scopeId(string $templateName, bool $debug): string
```
Returns the scope identifier. Debug: `$templateName`. Production: `substr(hash('sha256', $templateName), 0, 8)`.
