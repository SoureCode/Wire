# Wire Permission and Access

## Goal

Wire should expose only properties the rendered Twig output is allowed to use.

Wire should use Symfony's existing authorization tools instead of inventing a parallel permission system.

Rendered Twig usage is the read permission signal.

Wire access attributes define permissions when Twig did not already prove the property is needed for the current user.

Attributes cannot deny a property that rendered Twig needs.

Property access must be enforced on the server.

Client-side checks are only a convenience layer.

## Symfony Tools

Symfony already provides these useful pieces:

- Twig `is_granted(...)` for template-level display decisions.
- PHP `#[IsGranted(...)]` for controller-level checks.
- `Symfony\Bundle\SecurityBundle\Security` for service-level `isGranted(...)` checks.
- `AuthorizationCheckerInterface` for lower-level authorization checks.
- Voters for central permission logic.
- Serializer `#[Groups]`, `#[Ignore]`, and `AbstractNormalizer::ATTRIBUTES` for shaping normalized output.
- PropertyAccess for reading object paths consistently.

Serializer metadata shapes payloads.

Security decides permission.

Do not treat serializer groups as the permission system.

## Rendered Usage

Twig decides what rendered.

If a template gates a property with `is_granted`, only the rendered branch contributes usage.

Example:

```twig
{% wire %}
    {{ user.name }}

    {% if is_granted('VIEW_EMAIL', user) %}
        {{ user.email }}
    {% endif %}
{% endwire %}
```

If `VIEW_EMAIL` is denied, Twig does not render `user.email`, so `email` does not enter the Wire payload.

The target implementation cannot rely only on compile-time AST path collection for permission-sensitive usage.

It needs render-time usage collection, or another mechanism that records only emitted bindings.

## Property Access Gate

Every property path emitted by Wire must be authorized.

Rendered Twig usage authorizes read inclusion.

Wire access attributes handle cases not proven by rendered Twig usage.

```php
#[\Attribute(\Attribute::TARGET_PROPERTY | \Attribute::TARGET_METHOD)]
final class WireRead
{
    public function __construct(
        public readonly string $attribute,
    ) {
    }
}

#[\Attribute(\Attribute::TARGET_PROPERTY | \Attribute::TARGET_METHOD)]
final class WireWrite
{
    public function __construct(
        public readonly string $attribute,
    ) {
    }
}
```

Access attributes are explicit declarations:

```php
class User
{
    #[WireRead('VIEW_EMAIL')]
    #[WireWrite('EDIT_EMAIL')]
    public string $email;
}
```

Rules:

1. Rendered Twig usage decides whether a path is considered.
2. PropertyAccess verifies the path is technically readable or writable.
3. If Twig rendered a read path, Wire may include that read path.
4. `#[WireRead(...)]` can allow read paths needed outside rendered Twig usage.
5. `#[WireWrite(...)]` decides whether the current user may write the path.
6. Missing `#[WireWrite]` means write denied.

Wire access attributes do not replace Symfony Security.

They only declare which Symfony Security attribute Wire should ask about.

Wire must not let `#[WireRead]` deny a path that rendered Twig used.

The security subject should include the object and path:

```php
final class WirePropertySubject
{
    public function __construct(
        public readonly object $object,
        public readonly string $path,
    ) {
    }
}
```

Wire access attributes call Symfony Security with the declared attribute and a property subject:

```php
$security->isGranted('VIEW_EMAIL', new WirePropertySubject($user, 'email'));
$security->isGranted('EDIT_EMAIL', new WirePropertySubject($user, 'email'));
```

Applications can also use domain attributes:

```twig
{% if is_granted('VIEW_EMAIL', user) %}
    {{ user.email }}
{% endif %}
```

The application may satisfy those attributes with roles, voters, or any normal Symfony Security rule.

## Permission Masks

The global payload may merge fields across scopes.

That is allowed.

- Scope `a` renders `user.name`.
- Scope `b` renders `author.email`.
- Both handles point to the same entity.
- If the current user may read both fields, both handles can read both fields.

Wire does not isolate fields by scope.

Wire does not add another read gate after Twig rendered a field.

The entity payload contains the union of all rendered fields for the current user, plus any explicitly allowed non-rendered fields.

Read access is implicit.

If a property exists in the entity payload, it is readable.

Write access is explicit on `__wire.write`:

```json
{
  "entities": {
    "u7f31a9c:42": {
      "__wire": {
        "type": "u7f31a9c",
        "id": 42,
        "write": []
      },
      "name": "Alice",
      "email": "alice@example.com"
    }
  },
  "scopes": {
    "8b1f2c9a": {
      "handles": {
        "user": "u7f31a9c:42"
      }
    },
    "31e0a7d4": {
      "handles": {
        "author": "u7f31a9c:42"
      }
    }
  }
}
```

Each handle returns the same proxy.

The proxy exposes the page-wide union of rendered fields.

If Twig exposed a field, the user has read access to that field for this page.

## Write Gate

Write permission is separate from read permission.

A field can be readable but not writable.

The client must not send a write path unless `__wire.write` contains that path.

The server must still validate every submitted path through the declared `#[WireWrite]` attribute.

The server drops or rejects unauthorized write paths.

Rejecting is clearer for application bugs.

## Actions

Current Wire actions are read and update only.

Read is available only when the server emitted a read endpoint.

Update is available only when the server emitted an update endpoint.

Wire evaluates the Symfony attributes on the configured endpoint before exposing or executing the action.

Endpoint attributes include `#[IsGranted]` and other Symfony controller metadata that affects access.

If the read endpoint denies access, Wire must not expose read.

If the update endpoint denies access, Wire must not expose update.

Update must still be limited by `__wire.write`.

If `__wire.write` is empty, the proxy may still read but must not submit field updates.

Delete, upload, and custom actions are out of scope for this plan.

## Serializer Role

Serializer groups and `AbstractNormalizer::ATTRIBUTES` are useful after access has been decided.

Serializer metadata is not used to grant permission.

It may still limit what the normalizer can output after Twig/security have selected allowed paths.

Suggested order:

1. Collect rendered usage paths.
2. Keep rendered read paths.
3. Build per-entity `__wire.write` from writable paths.
4. Merge allowed paths into the global entity payload.
5. Normalize only those allowed paths.

Serializer groups can still provide a coarse allow-list.

They should not replace `isGranted` or voters.

## Client Role

The client receives scope handles.

The client can throw when code reads a path that is absent from the entity payload.

The client can throw when code writes a path outside `__wire.write`.

These checks improve developer feedback.

They are not security boundaries.

The server remains authoritative.

## Current Implementation Gap

The current implementation collects paths from Twig print nodes at compile time.

That means permission-sensitive conditional usage cannot be represented precisely enough.

The target design needs to collect actual rendered usage before emitting the global JSON payload.

## Scope

This document defines permission and access direction.

It depends on `docs/plan/wire-identity.md` and `docs/plan/wire-global-payload.md`.

It does not define repositories, routing, CSRF, validation, or error contracts.
