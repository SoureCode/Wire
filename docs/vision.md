# Wire

Wire is a **Symfony framework** for reactive server-rendered apps. Render Twig as usual; Wire ties the rendered DOM to the underlying entities and keeps both sides in sync, end-to-end through the Symfony stack.

A `{% wire %}` block exposes its scope's entities to the browser. Wire wraps them in proxies, mirrors mutations to the DOM, and round-trips changes back through Symfony routes — with Forms, Validator, Serializer, Security, and Doctrine doing the work they already do on the server.

## What Wire is

- A Symfony bundle. One `composer require`, one bundle line, autoconfigured.
- A reactivity layer for entities already rendered into the page.
- A protocol: identity-tagged JSON, RFC 9457 errors, optimistic concurrency.
- A bridge to Symfony Forms, Validator, Serializer, Security, and Doctrine — not a replacement for any of them.

## What Wire is not

- Not a client-side renderer. Wire keeps existing DOM alive; it does not add new nodes.
- Not a virtual DOM. No diffing tree, no hydration step, no JSX.
- Not a state manager. Truth lives in the entity on the server.
- Not a computed-values engine. Derive in PHP, ship the result.

## Positioning

Wire is closest in spirit to Symfony UX LiveComponent and Hotwire, but the unit is the **entity**, not the component or the HTML fragment:

| Tool | Unit | Server round-trip | Reactivity granularity |
|------|------|-------------------|------------------------|
| LiveComponent | Component class + template | Re-render fragment | Component re-render |
| Hotwire / Turbo | Frame / Stream | Re-render fragment | Frame swap |
| Vue / React | Component tree | None (or custom) | Virtual DOM diff |
| **Wire** | **Doctrine entity** | **Identity-tagged JSON** | **Bound DOM nodes per field** |

Pick Wire when your data model is already entities and you want the DOM to reflect them without writing a parallel JS model.

## Why

Server-side frameworks force a choice: full server render with no reactivity, or a JS framework with full hydration, big bundles, and a duplicate data model. Wire occupies the space between by treating the server entity as the only model and binding it directly to the DOM.

The surface area is small on purpose. Wire ties Symfony's existing pieces together; it does not invent parallel ones.
