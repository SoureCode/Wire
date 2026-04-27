# Future: Wire Repositories

## Position

**A WireRepository is the only way to serve a Wire entity.** One class per entity, owning every operation Wire can perform on that entity:

- **list** — fetch a collection (with filter / pagination / ordering),
- **read** — fetch one by identity,
- **create** — persist a new instance, assign identity, return it,
- **update** — apply changes to an existing instance,
- **delete** — remove an existing instance,
- **upload** — accept `multipart/form-data` and return a reference (see `wire-value-objects.md`).

There is no implicit Serializer + Doctrine + Form pipeline behind the framework. Every generated route, every bootstrap pass, every `$`-method on the client resolves to a repository method. An entity without a repository is a compile-time error.

The naming mirrors Doctrine's repository pattern on purpose: a repository is the canonical "everything about persisting and retrieving this aggregate" object. Wire repositories extend the same idea to the wire protocol — identity tagging, payload shape, listener hooks — without touching HTTP.

## Interfaces

```php
namespace SoureCode\Wire\Repository;

interface WireRepositoryInterface {}                    // marker

interface WireListRepositoryInterface   extends WireRepositoryInterface
{ public function list(WireListContext $ctx): WireList; }

interface WireReadRepositoryInterface   extends WireRepositoryInterface
{ public function read(WireReadContext $ctx): object; }

interface WireCreateRepositoryInterface extends WireRepositoryInterface
{ public function create(WireCreateContext $ctx): object; }

interface WireUpdateRepositoryInterface extends WireRepositoryInterface
{ public function update(WireUpdateContext $ctx): object; }

interface WireDeleteRepositoryInterface extends WireRepositoryInterface
{ public function delete(WireDeleteContext $ctx): void; }

interface WireUploadRepositoryInterface extends WireRepositoryInterface
{ public function upload(WireUploadContext $ctx): WireReference; }
```

Repositories return the **entity** for read / create / update; the bundle's response listener serializes it (identity tags + read groups) into the wire format. There is no `WirePayload` value object to construct — that step is the framework's job, not the repository's. List returns a `WireList` envelope (`items: object[]`, `total`, `page`, `pageSize`, `cursor`) because pagination metadata needs a carrier; each item is still a plain entity.

A class implements only the operations it serves. The bundle wires up exactly the routes whose interfaces the class implements; the rest throw "no route configured" client-side. Capability is inspectable from the class signature alone.

## Context Objects

```php
final class WireListContext
{
    public string $class;
    public array  $filters;        // decoded from query string, schema declared by repo
    public array  $sort;           // [['field' => 'name', 'dir' => 'asc'], ...]
    public int    $page;
    public int    $pageSize;
    public ?string $cursor;
    public Request $request;
    public ?UserInterface $user;
    public array  $groups;
}

final class WireReadContext { /* class, id, request, user, groups */ }
final class WireCreateContext { /* class, payload, request, user, groups */ }
final class WireUpdateContext extends WireReadContext { /* + payload, version, method (PATCH|PUT) */ }
final class WireDeleteContext extends WireReadContext { /* + version */ }
final class WireUploadContext { /* class, field, file, request, user */ }
```

Repositories see no `Request` mutation, build no `Response`, and never depend on the controller layer.

## Declaration

Required on every `#[Wire]` class:

```php
#[Wire(repository: UserWireRepository::class)]
class User { /* ... */ }
```

Compile-time check: the bundle fails to boot if any `#[Wire]` class lacks `repository:`. There is no fallback. There is no "if no repository, then…".

A repository serves one entity. To serve N entities, write N repositories. To share logic, inject a service into each — composition, not inheritance.

For Doctrine-managed entities — the common case — the bundle ships `DoctrineWireRepository` as a base class. The user repository extends it and overrides only what differs from the default behavior. Non-Doctrine sources implement the interfaces directly (no shipped base).

By convention Wire repositories live in `App\Wire\` so they coexist with Doctrine repositories in `App\Repository\` without renaming either side.

```php
namespace App\Wire;

use App\Entity\User;
use App\Repository\UserRepository;
use Doctrine\ORM\QueryBuilder;
use SoureCode\Wire\Attribute\AsWireRepository;
use SoureCode\Wire\Repository\DoctrineWireRepository;

#[AsWireRepository(entity: User::class)]
class UserWireRepository extends DoctrineWireRepository
{
    public function __construct(private readonly UserRepository $users) {}

    protected function buildListQueryBuilder(WireListContext $ctx): QueryBuilder
    {
        return $this->users->createListQueryBuilder($ctx->filters, $ctx->sort);
    }
}
```

That is the entire repository for an entity with no special rules: list/read/create/update/delete are inherited. Override any method to customize.

The base class follows the Symfony `AbstractController` pattern: it implements `ServiceSubscriberInterface`, the container injects a service locator via a `#[Required]` setter, and the abstract pulls `EntityManagerInterface`, `SerializerInterface`, `ValidatorInterface`, `WirePaginator`, and `WireGroupResolverInterface` from the locator on demand. The subclass's constructor stays free for application services only — no `Deps` bag, no `parent::__construct(...)`, no boilerplate.

The entity class is read once from `#[AsWireRepository(entity: ...)]` via reflection; the subclass does not pass it in. To override (e.g. for `Mapped Superclass` polymorphism), implement `protected function entityClass(): string`.

### What `DoctrineWireRepository` does

- `list($ctx)` — calls `buildListQueryBuilder($ctx)` (override point), paginates via `WirePaginator`, returns `WireList`.
- `read($ctx)` — `EntityManager::find($entityClass, $ctx->id)`, throws `WireNotFoundException` on miss.
- `create($ctx)` — `Serializer::denormalize` (with resolved write groups) → `Validator::validate` → throw `WireValidationException` on violations → `persist` + `flush` → return the entity.
- `update($ctx)` — `find` + `EntityManager::lock(..., LockMode::OPTIMISTIC, $ctx->version)` → `denormalize` with `OBJECT_TO_POPULATE` → validate → `flush` → return the entity.
- `delete($ctx)` — `find` + `lock` + `remove` + `flush`.

Each step is a `protected` method (`denormalizeForCreate`, `denormalizeForUpdate`, `validate`, `loadEntity`, `lockEntity`, …) that subclasses override surgically without rewriting the whole operation.

### Override examples

```php
// Custom validation groups based on the current user
protected function validate(object $entity, WireWriteContext $ctx): void
{
    $violations = $this->validator->validate(
        $entity,
        groups: $ctx->user?->isAdmin() ? ['Default', 'admin'] : ['Default'],
    );
    if (count($violations) > 0) {
        throw new WireValidationException($violations);
    }
}

// Authorization on update
public function update(WireUpdateContext $ctx): User
{
    $this->security->denyAccessUnlessGranted('EDIT', $this->read($ctx));
    return parent::update($ctx);
}

// Replace update entirely with a command bus
public function update(WireUpdateContext $ctx): User
{
    $this->bus->dispatch(new ChangeUser($ctx->id, $ctx->payload, $ctx->version));
    return $this->read(WireReadContext::from($ctx));
}
```

### Notes

- **Return is the entity.** The bundle's response listener tags identity (`__class` hash + `__id`) and serializes via the resolved read groups. Repositories never construct `WirePayload`.
- **Validation** lives in `DoctrineWireRepository::validate()` — `Symfony\Validator` + throw `WireValidationException`. The bundle maps it to a 422 RFC 9457 problem.
- **Version checks** are explicit `EntityManager::lock($user, LockMode::OPTIMISTIC, $ctx->version)` calls in the base class; `OptimisticLockException` → 409 with `serverSnapshot`. Override `lockEntity()` to disable or change the policy.
- **Form-based writes** use the parallel base class `DoctrineFormWireRepository` — same shape, but `denormalizeForCreate` / `denormalizeForUpdate` route through Symfony Forms instead of the Serializer (see `wire-form-bridge.md`).
- **Non-Doctrine sources** (Elasticsearch, command bus over a projection, third-party API) skip the base class and implement the interfaces directly. There is no "DoctrineFreeWireRepository" — the interfaces are small enough that direct implementation is the simplest path.

Doctrine's `App\Repository\UserRepository` is the right home for query logic (`createListQueryBuilder`, named finders) — the Wire repository consumes it. Don't introduce a parallel "query service" layer; if Doctrine's repository is missing a method, add the method there.

## Custom Routes

Domain operations that don't fit `read / create / update / delete` (e.g. `POST /api/user/{id}/promote`) are plain Symfony controllers. They are not Wire endpoints. The controller injects whatever services it needs — including the entity's `WireRepository` — and returns a `JsonResponse` directly.

```php
#[Route('/api/user/{id}/promote', methods: ['POST'])]
public function promote(int $id, UserWireRepository $repo, PromotionService $promotions): JsonResponse
{
    $user = $repo->read(WireReadContext::ofId($id));
    $promotions->promote($user);
    return $this->json($user);
}
```

A custom controller is not "an override of the wire repository." A repository serves one entity end-to-end; alternative behaviors are alternative methods on that repository or alternative services the controller composes. There is no `#[WireEndpoint(repository: …)]` swap mechanism — the per-`(class, op)` selection is single-source: `#[Wire(repository: …)]`.

To get the bundle's request/response listener chain (CSRF, error → RFC 9457, identity tagging on the response) on a custom route, mark the controller method with `#[WireEndpoint]` (no parameters). The marker opts the route into the listeners; nothing else changes.

## Shipped Base Classes and Helpers

The bundle ships two abstract bases for the common Doctrine cases, plus small services for everything else:

| Class / service | Purpose |
|-----------------|---------|
| `Wire\Repository\DoctrineWireRepository` | Doctrine + Serializer + Validator + Paginator. Implements all six interfaces; subclasses override `protected` step methods. |
| `Wire\Repository\DoctrineFormWireRepository` | Same as above but write paths route through Symfony Forms (`WireFormApplier` internally). See `wire-form-bridge.md`. |
| `Wire\Bridge\Doctrine\WirePaginator` | `QueryBuilder` + `WireListContext` → `WireList`. Used by the base; available standalone for direct-implementation repositories. |
| `Wire\Form\WireFormApplier` | `submit` + `clearMissing` per HTTP method, throws `WireValidationException`. Used by `DoctrineFormWireRepository`; available standalone. |
| `Wire\Bridge\Doctrine\WireIdentityExtractor` | managed entity → `__class` / `__id` / `__version` tags. Used by the response listener; rarely injected directly. |
| `Wire\Upload\WireUploadHandler` | `UploadedFile` → `WireReference` (Flysystem-backed by default). Inject in repositories that implement `WireUploadRepositoryInterface`. |

The bases are abstract; you must subclass and supply at least the entity class via the parent constructor. None of the helpers are themselves repositories — calling a helper does not serve a route. Identity tagging and serialization of returned entities is the bundle's response listener, not a public helper — repositories return entities, never `WirePayload`.

There is no `repositoryOptions`, no `#[Wire(readGroups: …)]`. Configuration lives in your subclass: constructor parameters, override-points, or the bundle-wide `WireGroupResolverInterface` for per-user policy.

## Lists / Collections

`WireListRepositoryInterface::list()` is the only way to fetch a collection of a Wire entity through the framework. Two client access paths:

### Bootstrap (template-driven)

The controller passes whatever it wants — a single entity, a Doctrine `Collection`, an array, any iterable of entities. `{% wire %}` walks its scope, infers per variable whether it's a single entity or a collection of Wire-bound entities, and registers it under the variable's name.

```php
public function index(UserRepository $users): Response
{
    return $this->render('user/index.html.twig', [
        'users' => $users->findAll(),     // array<User> — Twig detects entity type from the first item
    ]);
}
```

```twig
{% wire %}
<ul>
    {% for user in users %}
        <li data-user-id="{{ user.id }}">{{ user.name }}</li>
    {% endfor %}
</ul>
{% endwire %}
```

No `wire_list` tag. No `WireListContext` plumbing. No `WireList` envelope. The repository's `list()` is only for the JS path (`Wire.list(alias, options)`) — the template path uses what Doctrine already gives you. Each item is a normal entity proxy with full `$`-method surface (`$update`, `$delete`, `$on`, …). The list **container** itself has no `$`-methods — see `wire-collections.md`.

### Runtime (JS)

```js
const result = await Wire.list('user', {
    filters: { role: 'admin' },
    sort:    [{ field: 'name', dir: 'asc' }],
    page:    1,
    pageSize: 25,
});

result.items;     // proxy[]
result.total;     // number
result.page;      // number
result.cursor;    // string | null
```

Maps to a generated `_wire_user_list` route. Repositories without `WireListRepositoryInterface` produce no list route; `Wire.list(...)` throws "no list repository configured" before issuing a request.

Filters and sort are validated against `repositoryOptions.list.allowed*`. Unknown keys → 400. Cursor pagination is opt-in — the repository returns `cursor` instead of relying on `page`; both can coexist.

## Custom Repository — Non-Doctrine

```php
#[AsWireRepository(entity: SearchResult::class)]
final class SearchResultWireRepository implements
    WireReadRepositoryInterface,
    WireListRepositoryInterface
{
    public function __construct(private readonly Elasticsearch $client) {}

    public function read(WireReadContext $ctx): SearchResult
    {
        $hit = $this->client->get(['index' => 'docs', 'id' => $ctx->id]);
        return SearchResult::fromHit($hit);
    }

    public function list(WireListContext $ctx): WireList
    {
        $hits = $this->client->search([
            'index' => 'docs',
            'body'  => ['query' => ['match' => $ctx->filters], 'size' => $ctx->pageSize],
        ]);

        return new WireList(
            items: array_map(SearchResult::fromHit(...), $hits['hits']['hits']),
            total: $hits['hits']['total']['value'],
            page:  $ctx->page,
            pageSize: $ctx->pageSize,
        );
    }
}
```

No Doctrine, no Serializer. `SearchResult` is a plain PHP class; the bundle's response listener tags identity and serializes it via the resolved groups. The repository never constructs payload objects.

## Custom Repository — Command Bus

```php
#[AsWireRepository(entity: Order::class)]
final class OrderWireRepository implements
    WireReadRepositoryInterface,
    WireUpdateRepositoryInterface,
    WireDeleteRepositoryInterface
{
    public function __construct(
        private readonly OrderProjection $projection,
        private readonly MessageBusInterface $bus,
    ) {}

    public function read(WireReadContext $ctx): OrderView
    {
        return $this->projection->get($ctx->id);
    }

    public function update(WireUpdateContext $ctx): OrderView
    {
        $this->bus->dispatch(new ChangeOrder($ctx->id, $ctx->payload, $ctx->version));
        return $this->read(WireReadContext::from($ctx));
    }

    public function delete(WireDeleteContext $ctx): void
    {
        $this->bus->dispatch(new CancelOrder($ctx->id, $ctx->version));
    }
}
```

## Errors

Repositories throw; the bundle maps. This is the only error contract.

| Throw | RFC 9457 type | Status |
|-------|---------------|--------|
| `WireValidationException(violations \| Form)` | `validation` | 422 |
| `WireConflictException(serverSnapshot)` | `conflict` | 409 |
| `WireNotFoundException` | `not_found` | 404 |
| `Symfony\…\AccessDeniedException` | `auth` | 403 |
| anything else | `server` | 500 |

Repositories never build `JsonResponse`. The bundle does. See `wire-error-contract.md`.

## Selection (Compile Time)

Per `(class, op)`, exactly one repository: `#[Wire(repository: …)]` on the entity class. Resolved at compile time and cached in the container. No runtime `supports()`, no priority chain, no override hooks. Missing interface → no route → static error client-side.

## Decoration

Standard `#[AsDecorator]` works on shipped repositories — useful for cross-cutting concerns (logging, audit, feature flags, soft tenancy) without forking. Decorators participate in the same compile-time wiring; their interface set must match the inner repository's exactly.

## Testing

Repositories are plain services with no kernel dependency in their public surface. Construct a `Wire*Context::stub(...)` and assert on the returned payload. Integration tests exercise the route only when verifying listener behavior — repository logic is testable without HTTP.

## Cross-References

- `wire-bundle.md` — generated controllers are pure delegation shells; the bundle ships listeners and route generation, not pipelines.
- `wire-form-bridge.md` — `WireFormApplier` is a shipped repository.
- `wire-serializer-groups.md` — group resolution is consumed by the repository's own `Serializer::denormalize(... 'groups' => $ctx->groups)` call (writes) and the bundle's response listener (reads); non-serializer repositories ignore both.
- `wire-doctrine.md` — helpers reusable when writing custom Doctrine-backed repositories; the shipped Doctrine repositories use the same helpers.
- `wire-create-delete.md` — `WireCreateRepositoryInterface` / `WireDeleteRepositoryInterface` slot into the same compile-time selection.
- `wire-collections.md` — list **fetching** lives on the repository; collection **proxies** still expose no `$`-methods.
- `wire-error-contract.md` — exception → problem document is the bundle's job.

## Out of Scope

- Compile-time scaffolding from schemas. Repositories are small; write them.
- Async repositories. Synchronous interface; dispatch async work inside an operation, return synchronously.
- Cross-entity transactions exposed through one repository. Repositories are per-entity; multi-entity work happens behind a custom controller that calls multiple repositories.
