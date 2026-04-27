# Future: Symfony Bundle

## Install

```bash
composer require sourecode/wire-bundle
```

Symfony Flex registers `SoureCode\WireBundle\WireBundle` and writes `config/packages/wire.yaml`. No manual wiring.

## Bundle Layout

```
src/
├── Attribute/                 # #[Wire], #[WireField]
├── Bridge/
│   ├── Doctrine/              # metadata, lazy-proxy resolution, UoW listener
│   ├── Form/                  # see wire-form-bridge.md
│   ├── Security/              # voter integration, CSRF listener
│   ├── Serializer/            # group resolver, normalizers (DateTime, Money, ...)
│   └── Validator/             # ConstraintViolationList → RFC 9457 mapper
├── Controller/                # generated read/update/upload endpoints
├── EventListener/             # KernelEvents::REQUEST/RESPONSE/EXCEPTION wiring
├── Routing/                   # WireRouteLoader for auto-generated routes
├── Twig/                      # WireExtension, {% wire %} TokenParser
└── DependencyInjection/       # WireExtension, Configuration
```

## Configuration

```yaml
# config/packages/wire.yaml
wire:
    csrf:
        enabled: true
        token_id: wire
        header: X-CSRF-Token
    routes:
        # auto-generate read/update routes from #[Wire] attributes
        auto_generate: true
        prefix: /_wire
    serializer:
        date_format: !php/const DateTimeInterface::RFC3339_EXTENDED
        max_depth: 3
    error:
        problem_base_uri: 'https://wire.dev/problems/'
    upload:
        enabled: true
        max_size: 10M
        storage: default            # Flysystem adapter id
```

Every key is overridable per environment. Defaults are production-safe.

## Auto-Generated Routes

`#[Wire]` requires `repository:`. Routes are generated for exactly the operations the repository implements (`WireReadRepositoryInterface`, `WireCreateRepositoryInterface`, `WireUpdateRepositoryInterface`, `WireDeleteRepositoryInterface`, `WireUploadRepositoryInterface`). No interface → no route → client-side `$`-method throws "no route configured". See `wire-repository.md`.

```php
#[Wire(repository: UserRepository::class)]
class User { /* ... */ }
```

Generated controllers are pure delegation shells: pull the `*Context` from the request, hand it to the repository, serialize the returned entity (or `WireList`) to JSON via the response listener. They contain no business logic and no fallback path.

Custom routes are plain Symfony controllers — not "wire-repository overrides." Mark the method with `#[WireEndpoint]` (no arguments) to opt the route into the bundle's request/response listeners (CSRF, error normalization, identity tagging on the response). The repository selection per `(class, op)` is single-source: `#[Wire(repository: …)]`.

There is no implicit "if no repository, the framework will figure it out" behavior. The bundle's `Configuration` pass fails the build when a `#[Wire]` class lacks a repository.

## Services

All public services use stable interface ids; implementations are swappable.

| Interface | Purpose |
|-----------|---------|
| `Wire\Group\WireGroupResolverInterface` | resolve effective serializer groups per `(entity, user, op)` |
| `Wire\Identity\IdentityExtractorInterface` | produce `__class` / `__id` / `__version` for an entity |
| `Wire\Diff\PayloadBuilderInterface` | compute PATCH diff vs last snapshot (server-side companion to JS) |
| `Wire\Error\ProblemFactoryInterface` | build RFC 9457 documents from exceptions / violations |
| `Wire\Bootstrap\PayloadRendererInterface` | render the JSON island consumed by `{% wire %}` (delegates to each entity's read repository) |
| `Wire\Repository\WireReadRepositoryInterface` and siblings | the only application extension point; see `wire-repository.md` |

Autowire by interface; decorate when needed. No factory boilerplate.

## Twig Tag

`{% wire %}` is provided by `WireExtension`. The TokenParser collects every entity referenced inside the block, lets `IdentityExtractorInterface` and the configured group resolver tag them, and emits one `<script type="application/json" data-wire-bootstrap>` island plus the `<meta name="wire-csrf">` token. No `groups` attribute on the tag — see `wire-serializer-groups.md`.

## Identity on the Wire

The wire identity tag is `{ "__class": <stable-string>, "__id": <id> }`. `__class` is a stable opaque token, **never** a PHP FQCN:

- **prod**: `substr(hash('sha256', $fqcn), 0, 8)` — short, unguessable, FQCN never leaks to the client.
- **debug**: full FQCN, for legible payloads in dev.

The hash means clients cannot construct identity tags from a class name they invented. Every identity that travels over Wire originated server-side.

Because the hash is unpredictable, **JS code never references entities by FQCN or by hash**. It uses the Twig variable name as the alias:

```twig
{% wire %}
    {# `user` and `address` are bindings in this scope #}
    <h1>{{ user.name }}</h1>
    <span>{{ address.city }}</span>
{% endwire %}
```

```js
const draft = Wire.create('user',  { name: 'Alice' });
const list  = await Wire.list('user', { page: 1 });
```

The bootstrap island carries an alias-to-hash map for every variable bound in the surrounding `{% wire %}` scope. `Wire.create('user', …)` and `Wire.list('user', …)` resolve `'user'` against that map. An alias not present in any rendered scope throws synchronously — no request is made.

There is no entity-level alias attribute. The alias is the Twig variable name, period. Two different templates can call the same entity by different names without collision; a page that does not bind the entity in any `{% wire %}` block cannot address it from JS.

## Kernel Events

| Event | Listener | Job |
|-------|----------|-----|
| `kernel.request` | `WireCsrfListener` | validate CSRF on Wire-tagged routes |
| `kernel.controller_arguments` | `WireArgumentResolver` | resolve `WireRequest` (typed JSON body, identity already verified) |
| `kernel.exception` | `WireExceptionListener` | map `ValidationFailedException`, `OptimisticLockException`, `AccessDeniedException` to RFC 9457 |
| `kernel.response` | `WireResponseListener` | force `application/problem+json` on errors; inject identity tags if missing |

## Maker Commands

```bash
bin/console make:wire:entity User       # scaffold #[Wire] entity + migrations
bin/console make:wire:controller Order  # custom read/update controllers wired to a #[Wire] entity
bin/console wire:debug                  # list Wire entities, routes, groups, conflicts
```

## Profiler / DevTools (Server-Side)

A WebProfilerBundle panel exposes per-request:

- Wire entities serialized (class, id, version, groups).
- Diff payload received vs. fields actually written.
- Validator violations and the resulting Problem document.
- Voter decisions for each Wire entity.

Client-side devtools remain out of scope; the server-side profiler is enough to debug round-trips.

## Compatibility

- Symfony 7.2+ (LTS at time of writing) and PHP 8.4+.
- Doctrine ORM 3+, Doctrine DBAL 4+.
- Twig 3+.
- Optional: API Platform — Wire defers to API Platform routes when `#[Wire(readRouteName: ...)]` points at one.

## Out of Scope (Bundle Level)

- Bundling a JS build. The `wire.js` runtime ships via npm; bundle ships only PHP.
- Asset Mapper / Webpack Encore opinions. Either works; the bundle exposes asset paths via `wire:debug`.
- Messenger integration. Async flows are application concern.
