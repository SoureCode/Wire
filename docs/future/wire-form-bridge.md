# Future: Form-Backed Repository

## Position

Symfony Forms participate in Wire as a **base class** — `DoctrineFormWireRepository` — that mirrors `DoctrineWireRepository` but routes writes through a `FormType` instead of the Serializer. Pick the base that matches how you want writes to happen; subclass it once per entity. There is no separate "applier" object to compose. See `wire-repository.md`.

## Usage

```php
namespace App\Wire;

use App\Entity\User;
use App\Form\UserType;
use App\Repository\UserRepository;
use Doctrine\ORM\QueryBuilder;
use SoureCode\Wire\Attribute\AsWireRepository;
use SoureCode\Wire\Repository\DoctrineFormWireRepository;

#[AsWireRepository(entity: User::class)]
class UserWireRepository extends DoctrineFormWireRepository
{
    public function __construct(private readonly UserRepository $users) {}

    protected function formType(WireWriteContext $ctx): string
    {
        return UserType::class;
    }

    protected function buildListQueryBuilder(WireListContext $ctx): QueryBuilder
    {
        return $this->users->createListQueryBuilder($ctx->filters, $ctx->sort);
    }
}
```

`formType()` is the only mandatory override. `buildListQueryBuilder` is inherited from `DoctrineWireRepository`. Read returns the managed entity. Create and update build the form, submit the context payload (`clearMissing: true` on PUT, `false` on PATCH), validate via Form, throw `WireValidationException($form)` on `!isValid()`, then `flush`.

## Override Points

Same shape as `DoctrineWireRepository` — protected step methods, all overridable:

- `formType(WireWriteContext): string` — the form class. Vary per request (e.g. role-based form variant) by branching on `$ctx->user`.
- `formOptions(WireWriteContext): array` — extra options passed to `FormFactory::create`. Common use: `validation_groups`.
- `loadEntity(WireReadContext): object` — entity used as the form's data. Default: `find` for update, `new $entityClass()` for create.

## Field Error Mapping

`WireExceptionListener` walks `$form->getErrors(deep: true, flatten: true)` on a thrown `WireValidationException` and emits an RFC 9457 problem keyed by `getPropertyPath()`. Form's `error_mapping` is the canonical source for dotted client-side paths:

```php
class UserType extends AbstractType
{
    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class'    => User::class,
            'error_mapping' => [
                'addressLine1' => 'address.line1',
            ],
        ]);
    }
}
```

```js
user.$getErrors('address.line1');
```

Same path, both directions.

## Validation Groups

Override `formOptions`:

```php
protected function formOptions(WireWriteContext $ctx): array
{
    return [
        'validation_groups' => $ctx->user?->isAdmin() ? ['Default', 'admin'] : ['Default'],
    ];
}
```

## Data Transformers

Form transformers run during `submit()`. The wire format on JS is the **view** representation (post-transform), matching what Form sends to its widgets. There is no JS-side mirror — duplicating the logic guarantees drift.

## CSRF

Form-level CSRF is forced off (`csrf_protection: false`) by the base class. The bundle's `WireCsrfListener` enforces a single project-wide token (`wire-csrf` meta + `X-CSRF-Token` header) — see `wire-csrf.md`. Two tokens for one request is pointless.

## Rendering

Forms still render Twig markup with `{{ form_widget(...) }}`. Wire binds to the rendered inputs by `name` / `id` like any other DOM. The `{% wire %}` block surrounds the form:

```twig
{% wire %}
    {{ form_start(form) }}
        {{ form_row(form.name) }}
        {{ form_row(form.address.line1) }}
        <button id="save">Save</button>
    {{ form_end(form, { render_rest: false }) }}
{% endwire %}
```

A Wire form-theme override adds `data-wire-form` to `form_start`; submission goes through `$update()` (or `$create()` on a draft) instead of native form POST.

## Collections (`CollectionType`)

Defers to `wire-collections.md`. Collection diffing is the application's concern; repositories iterate per entity.

## Out of Scope

- "Form-as-read." Forms describe writes. Read returns the entity directly; the bundle's response listener serializes.
- Dynamic form modification on the JS side (`PRE_SET_DATA` mirrors). The form runs server-side; the client reflects results.
- Custom Twig form themes for non-standard widget systems. Standard themes work; custom themes ship their own `data-wire-*` if needed.
