# Wire — Usage Example

## Entity

```php
use Doctrine\ORM\Mapping as ORM;
use SoureCode\Wire\Attribute\Wire;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity]
#[Wire(readRouteName: 'app_user_get', updateRouteName: 'app_user_save')]
class User
{
    #[ORM\Id, ORM\GeneratedValue, ORM\Column]
    public int $id;

    #[ORM\Column]
    #[Groups(['wire'])]
    public string $name;

    #[ORM\Column]
    public string $email;

    #[ORM\Embedded]
    public Address $address;
}
```

## Twig

```twig
{% wire cascade groups=['wire'] %}

<section data-user>
    <h1>{{ user.name }}</h1>
    <span>{{ user.name|upper }}</span>
    <span>{{ user.tags|length }}</span>
    <a class="card-{{ user.status|default('inactive') }}">{{ user.email }}</a>
    <a href="/u/{{ user.id }}/{{ user.slug }}">link</a>

    <input value="{{ user.name }}">
    <input value="{{ user.email }}">

    <p>{{ user.bio|reverse }}</p>
    <p>{{ format(user) }}</p>

    <button id="save">Save</button>
    <button id="reload">Reload</button>
    <button id="revert">Revert</button>
</section>

{% include 'address.html.twig' %}
```

```twig
{# address.html.twig #}
<address>
    <input value="{{ user.address.city }}">
    <span>{{ user.address.zip }}</span>
</address>
```

## JavaScript

```html
<script src="/wire.js"></script>
<script type="module">
const root  = document.querySelector('[data-user]');
const scope = Wire.getScope(root);
const user  = scope.get('user');

user.name = 'Bob';
user.address.city = 'Paris';

console.log(user.$getClass());
console.log(user.$getId());
console.log(user.$getSnapshot());
console.log(user.$isDirty());

const off = user.$on((newVal, oldVal, path) => console.log(path, oldVal, '→', newVal));
const offName = user.$on('name', (v) => console.log('name:', v));

document.querySelector('#save').addEventListener('click', async () => {
    try {
        await user.$update();
    } catch (error) {
        console.error(error.status, error.response);
    }
});

document.querySelector('#reload').addEventListener('click', async () => {
    if (user.$isDirty()) {
        await user.$read({ force: true });
    } else {
        await user.$read();
    }
});

document.querySelector('#revert').addEventListener('click', () => user.$revert());

console.log(user.$getHistory());

console.log(scope.getSnapshot());
console.log(scope.getSnapshot('user'));

await user.$update({
    headers: { 'X-Token': 'abc' },
    method: 'PATCH',
    url: '/api/user/42',
});

off();
offName();
</script>
```

## Reserved `$`-methods

| Method | Scope | Purpose |
|---|---|---|
| `$getClass()` / `$getId()` | any proxy | identity tags |
| `$getSnapshot()` | any proxy | deep clone, tags stripped |
| `$isDirty()` | entity | diff vs last server state |
| `$revert()` | entity | restore last server state |
| `$on(cb)` / `$on(path, cb)` | entity | subscribe; returns unsubscribe |
| `$update(options?)` | entity | POST/PUT body to `updateRouteName` |
| `$read(options?)` | entity | GET from `readRouteName`; needs `{ force: true }` if dirty |
| `$getHistory()` | entity | list of `read` / `update` round-trips |
