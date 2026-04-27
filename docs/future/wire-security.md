# Future: Security and Authorization

## Principle

The server is the only authority. Anything a client sends is suspect, including snapshots produced by Wire. Client-side guards exist only for UX; they never replace server-side checks.

## Field Whitelisting

A snapshot contains every tracked field on the proxy. Without a whitelist, a client can mutate `user.role = 'admin'` and `$update()` will faithfully ship that field. The repository must drop fields the current user is not allowed to write before applying them. `DoctrineSerializerRepository` does this through serializer write groups; `DoctrineFormRepository` through the form definition; custom repositories through whatever logic they implement. See `wire-repository.md` and `wire-serializer-groups.md`.

```php
#[Wire(
    readGroups:  ['user:read'],
    writeGroups: ['user:write'],
)]
class User
{
    #[Groups(['user:read', 'user:write'])]
    public string $name;

    #[Groups(['user:read'])]
    public string $role;
}
```

`role` is readable but never accepted on update. Wire will not introduce a JS-side "writable" flag — the wire format carries everything; the server filters.

## Per-Entity Authorization

`$read` and `$update` controllers run Symfony voters as usual. Wire adds nothing here — the route handler is plain Symfony.

```php
#[IsGranted('EDIT', subject: 'user')]
#[Route('/api/user/{id}', name: 'app_user_update', methods: ['PATCH'])]
public function update(User $user, Request $request): JsonResponse { /* ... */ }
```

A `403` response surfaces as `err.type === 'auth'` (see `wire-error-contract.md`).

## Per-Field Authorization

Voters run at the entity level. Field-level authorization is expressed by **conditional groups**: the controller chooses serializer groups based on the current user before serializing the response.

```php
$groups = ['user:read'];
if ($this->isGranted('VIEW_PII', $user)) {
    $groups[] = 'user:read:pii';
}
return $this->json($user, context: ['groups' => $groups]);
```

The client never sees fields outside its allowed groups; mutating a field that wasn't in the read response is a no-op on the server because it isn't in the write group either.

## Multi-Tenancy

Tenant filtering is a Doctrine concern (filters, query builders). Wire's `readRouteName` controller is responsible for scoping the lookup. There is no Wire-level tenant flag.

## Identity Tampering

`__class` and `__id` arrive from the server and round-trip back unchanged. The server **must** re-resolve the entity from `__id` (and verify ownership) on every `$update`. Trusting `__class` from the request is forbidden — the route already pins the entity type.

## Client-Side Guard (Non-Authoritative)

Optional UX-only helper:

```js
user.$lock(['role', 'email']);
user.role = 'admin';   // throws synchronously
```

Pure client convenience. Removing the lock or bypassing the proxy is trivial; never use it as a security boundary.

## Out of Scope

- Encryption at rest in the proxy.
- Rate limiting (Symfony RateLimiter component).
- Audit logging — application concern; `$getHistory()` is in-memory only.
