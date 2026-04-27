# 1. Symfony Integration Gaps

## 1.1 Forms vs Direct Entity Mutation

Symfony apps heavily rely on the Symfony Form Component.

**Gap:**

* Your model bypasses Forms entirely.
* No handling of:

    * Data transformers
    * Validation groups per form
    * CSRF protection
    * Field-level error mapping

**Impact:**

* Hard to adopt in existing CRUD apps.
* Validation UX becomes inconsistent.

**Mitigation:**

* Provide optional bridge:

    * `$update()` returns structured validation errors compatible with Form errors.
    * Support field-level error hydration:

      ```js
      user.$errors.name
      ```

---

## 1.2 Validation (Critical)

Symfony uses Symfony Validator Component.

**Gap:**

* No visible contract for validation errors.
* No distinction:

    * field errors
    * global errors
    * constraint metadata

**Required:**

Jason: https://www.rfc-editor.org/rfc/rfc9457

Define a canonical error format:

```json
{
  "errors": {
    "name": ["This value should not be blank."],
    "address.city": ["Invalid city"]
  }
}
```

Also:

* automatic binding to `$on()` updates
* `$isValid()` or `$getErrors()`

---

## 1.3 Serialization Boundaries

Uses Symfony Serializer.

**Gap:**

* `groups=['wire']` is static.
* No runtime control of:

    * read vs write groups
    * nested depth
    * circular references

**Problems:**

* Over-fetching
* Missing fields during update

**Expected in real apps:**

```php
#[Wire(readGroups: ['user:read'], writeGroups: ['user:write'])]
```

Also missing:

* partial updates (PATCH semantics vs full object send)

---

## 1.4 Security / Authorization

**Gap:**

* No mention of:

    * voters
    * per-field authorization
    * multi-tenant filtering

**Critical issue:**
User can mutate:

```js
user.role = 'admin'
```

**Needed:**

* Server-side field whitelist enforcement
* Optional client-side guard (non-authoritative)

---

## 1.5 CSRF / Auth Handling

**Gap:**

* `$update()` accepts headers, but:

    * no built-in CSRF strategy
    * no integration with Symfony security

**Expected:**

* automatic CSRF token injection
* cookie/session awareness
* 401/403 standardized handling

---

# 2. Doctrine & Persistence Gaps

## 2.1 Embedded / Relations

You show:

```php
#[ORM\Embedded]
public Address $address;
```

**Gap:**

* No handling for:

    * OneToMany collections
    * ManyToMany diffs
    * orphan removal

**Problem:**

```js
user.tags.push(...)
```

How is this serialized?

**Needed:**

* collection diffing strategy
* add/remove semantics instead of full replace

---

## 2.2 Identity & Lazy Objects

**Gap:**

* `$getClass()` / `$getId()` exists, but:

    * no handling for proxies
    * no partial objects

**Edge case:**

* referencing entities not fully loaded

---

## 2.3 Concurrency

**Missing entirely**

**Critical in real apps:**

* lost updates

**Needed:**

* versioning support (Doctrine `@Version`)
* ETag / If-Match support

---

# 3. HTTP Semantics

## 3.1 REST Mismatch

```js
await user.$update({ method: 'PATCH' })
```

But:

* default behavior unclear
* full object vs diff unclear

**Gap:**

* no clear contract:

    * PUT = full replace?
    * PATCH = partial?

---

## 3.2 Error Handling Contract

```js
catch (error) {
    console.error(error.status, error.response);
}
```

**Gap:**

* no normalized error shape
* no distinction:

    * validation
    * transport
    * server exceptions

**Needed:**

```js
error.type === 'validation' | 'network' | 'server'
```

---

## 3.3 Batching / Network Efficiency

**Missing:**

* request batching
* debounce
* optimistic updates

Current model:

* chatty for real apps

---

# 4. Twig / Rendering Gaps

## 4.1 Expression Coverage

Your Twig:

```twig
{{ user.name|upper }}
{{ user.tags|length }}
{{ format(user) }}
```

**Gap:**

* How are:

    * filters tracked?
    * functions tracked?
    * computed dependencies tracked?

**Risk:**

* inconsistent reactivity

---

## 4.2 Partial Template Updates

**Gap:**

* no DOM diffing strategy defined
* unclear if:

    * full re-render
    * granular patching

---

## 4.3 Includes

```twig
{% include 'address.html.twig' %}
```

**Gap:**

* scope propagation rules unclear
* reactivity boundary unclear

---

# 5. JavaScript API Gaps

## 5.1 Lifecycle

Missing:

* `$destroy()`
* cleanup when DOM removed

---

## 5.2 State Management

You have:

```js
scope.getSnapshot()
```

Missing:

* global store sharing across scopes
* cross-component sync

---

## 5.3 DevTools / Debuggability

Missing:

* inspection tools
* logging hooks
* time-travel debugging beyond `$getHistory()`

---

# 6. Edge Cases

## 6.1 Non-scalar Types

```php
public \DateTimeImmutable $createdAt;
```

**Gap:**

* serialization format?
* timezone handling?

---

## 6.2 Custom Value Objects

```php
public Money $price;
```

**Gap:**

* normalization / denormalization strategy

---

## 6.3 File Uploads

**Missing entirely**

---

## 6.4 Large Graphs

**Risk:**

* deep nested updates
* payload explosion

---

# 7. Conceptual Positioning Gap

Right now, the library overlaps with:

* Symfony UX LiveComponent
* Hotwire
* Vue.js (reactivity layer)

**But unclear:**

* Is it:

    * a transport layer?
    * a state manager?
    * a full reactive system?

This ambiguity will slow adoption.

---

# Summary of Critical Gaps

Highest priority issues:

1. Validation + error model
2. Security (field-level + server enforcement)
3. Doctrine relations handling
4. Concurrency control
5. Serializer group separation (read/write)
6. HTTP contract clarity (PATCH vs PUT)
7. Form integration strategy

---

# Suggested Next Steps

1. Define wire protocol (request/response schema)
2. Add validation/error system
3. Introduce relation diffing
4. Add versioning / concurrency support
5. Formalize serializer configuration
6. Document lifecycle and reactivity guarantees
