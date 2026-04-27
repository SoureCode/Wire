# Future: Serializer Groups (Repository Configuration)

## Position

Serializer groups are **not a property of `#[Wire]`** and **not a property of the framework**. They are configuration consumed by repositories that opt to use the Symfony Serializer — primarily `DoctrineSerializerRepository`. A custom repository that does not call the serializer (command bus, raw payload, search index) ignores groups entirely. See `wire-repository.md`.

The bundle does not own group policy. The repository does. This avoids the "groups mean different things in different code paths" problem.

## Configuration

```php
#[Wire(
    repository:        DoctrineSerializerRepository::class,
    repositoryOptions: [
        'readGroups'  => ['user:read'],
        'writeGroups' => ['user:write'],
    ],
)]
class User
{
    #[Groups(['user:read', 'user:write'])]
    public string $name;

    #[Groups(['user:read'])]
    public string $role;

    #[Groups(['user:write'])]
    public string $newPassword;
}
```

`DoctrineSerializerRepository` reads `readGroups` for `$read` responses and `writeGroups` for `$update` / `$create` denormalization. Identity tags (`__class`, `__id`, `__version`) are never gated by groups.

## Twig Tag

```twig
{% wire %}
```

No `groups` attribute. The repository resolves groups from the entity's configuration and the current user. Putting groups on the tag would let the template override the security boundary set in PHP.

## Per-User Group Resolution

`WireGroupResolverInterface` is the extension point:

```php
interface WireGroupResolverInterface
{
    public function resolveReadGroups(string $class, ?UserInterface $user, array $defaults): array;
    public function resolveWriteGroups(string $class, ?UserInterface $user, array $defaults): array;
    public function resolveValidationGroups(string $class, ?UserInterface $user, string $op, array $defaults): array;
}
```

Default implementation returns `$defaults`. Replace it for role-aware groups:

```php
final class TenantGroupResolver implements WireGroupResolverInterface
{
    public function resolveReadGroups(string $class, ?UserInterface $user, array $defaults): array
    {
        $groups = $defaults;
        if ($user?->isAdmin()) {
            $groups[] = $class . ':admin:read';
        }
        return $groups;
    }
    // ...
}
```

`DoctrineSerializerRepository` calls the resolver before each serialize/denormalize. Custom repositories may call it too, or invent their own policy — they own their pipeline.

## No `groups` Option in JS

Confirmed in `wire-entity-methods.md`. The client cannot pass groups to `$update` / `$read`. Allowing it would let any caller request fields the server didn't intend to expose. This is a hard rule across all repositories, not a `DoctrineSerializerRepository` quirk.

## Partial Payloads

`DoctrineSerializerRepository` honors PATCH/PUT semantics from `wire-http-contract.md`: PATCH denormalizes only sent fields onto the managed entity (`OBJECT_TO_POPULATE`); PUT replaces every field in `writeGroups`. `clearMissing` behavior matches what `DoctrineFormRepository` does for forms.

## Out of Scope

- Class-level read/write groups distinct from `#[Groups]` on properties. Use `#[Groups]` — that's already field-level.
- Dynamic group composition driven by the bootstrap payload. The server is the source of truth; the client never sees the group list.
- `MaxDepth` / circular reference handling. Use Symfony's existing tools; pass them through the serializer context inside the repository.
