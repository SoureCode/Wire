# Future: Non-Scalar Types and Value Objects

## Problem

PHP entities carry types JSON cannot represent: `\DateTimeImmutable`, `Money`, `Uuid`, enums, file references. The serializer turns them into strings or nested objects on the way out; on the way back in, the server must denormalize them. Wire needs a stable wire format and clear client-side ergonomics.

## Principle

The wire format is JSON. Everything non-scalar is a string or a tagged object. Reactivity sees the JSON shape; PHP-side normalization is the server's job.

## Date and Time

- `\DateTimeImmutable` and `\DateTime` serialize to **RFC 3339 / ISO 8601 with offset**: `2026-04-26T10:15:00+02:00`.
- Always include the offset. Never emit naïve local time.
- Date-only types serialize to `2026-04-26` (no time, no offset).
- Client side: the proxy holds the string. A helper `Wire.parseDate(user.createdAt)` returns a `Date`. Mutating with a `Date` object is allowed; Wire serializes back via `toISOString()` before sending. Templates that render dates use Twig filters server-side — for pure client display, application code formats the string itself.
- Symfony bridge: register `DateTimeNormalizer` with `DATETIME_FORMAT = DateTimeInterface::RFC3339_EXTENDED` and a fixed timezone policy. Wire does not pick the timezone — the application does.

## Enums

Backed enums serialize to their backing scalar; non-backed enums serialize to their case name. Server denormalizes by `from()` / case lookup. Invalid values produce a validation error per `wire-error-contract.md`.

## UUID and ULID

Serialize as canonical strings. Symfony's `Uid` component already handles normalization; Wire forwards.

## Custom Value Objects (e.g. `Money`)

Serialize as a plain object. The class is responsible for round-trip stability via a normalizer.

```json
{ "amount": 1299, "currency": "EUR" }
```

Mutating a single field on the proxy (`user.price.amount = 1500`) is a normal nested change and triggers a diff under `wire-http-contract.md`. The server's `MoneyNormalizer` reconstructs the value object before applying.

Recommended: tag value-object payloads optionally with `__class` to disambiguate when the same shape appears in multiple positions:

```json
{ "__class": "Money", "amount": 1299, "currency": "EUR" }
```

`__class` is server-side hint only; the proxy ignores it for reactivity but preserves it on round-trip.

## File Uploads

`$update()` ships JSON. Files do not. Wire keeps a separate path:

```js
const ref = await user.$upload(file, { field: 'avatar' });
user.avatar = ref;          // ref is a server-issued string id
await user.$update();
```

- `$upload` POSTs `multipart/form-data` to a configured `uploadRouteName` and returns the server's identifier (URL, UUID, or storage key).
- The entity field stores the reference, not the bytes. Subsequent `$update` ships the reference like any other string.
- Progress, cancellation, retry: application concern. `$upload` returns a `Promise` plus an `AbortSignal` hook.
- Direct-to-S3 / pre-signed URL flows: application provides the upload URL and skips `$upload` — store the resulting reference and call `$update`.

## Embedded Objects

Already supported via the proxy. `user.address.city = 'Paris'` produces a nested diff. No separate spec needed.

## Out of Scope

- Binary fields on the entity itself. Always go through an upload reference.
- Streaming responses.
- Decimal precision negotiation. Use strings for `decimal` columns; `BigDecimal` userland choice is the application's.
