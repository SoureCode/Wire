/**
 * @typedef {Object} Binding
 * @property {HTMLElement} element
 * @property {string} path - dot-separated data path, e.g. "user.address.city"
 * @property {string} target - "text" | "value" | any attribute name
 */

/**
 * Cross-scope alias map. Keys are dot-paths; each value is the list of
 * other locations bound to the same JS object — `scope: null` means the
 * alias lives in the same scope as the key. Aliases reference
 * ScopeBindings because update propagation needs to walk the aliased
 * scope's bindings, not just its data.
 *
 * @typedef {Object.<string, Array<{ scope: ScopeBindings|null, path: string }>>} RefMap
 */

/**
 * Minimal shape required by snapshot.
 *
 * @typedef {Object} ScopeSnapshot
 * @property {string} name
 * @property {Record<string, unknown>} data
 */

/**
 * Minimal shape required by updateBindings / updateScopeBindings: data,
 * bindings, and the refMap used for cross-scope propagation.
 *
 * @typedef {Object} ScopeBindings
 * @property {Record<string, unknown>} data
 * @property {Binding[]} bindings
 * @property {RefMap} refMap
 */

/**
 * Public scope handle returned by Wire.getScope(element). Exposes only the
 * variable-name lookup and a per-scope snapshot — scope identifiers and
 * internal binding state are not part of the user-facing surface.
 *
 * @typedef {Object} ScopeHandle
 * @property {(name: string) => unknown} get - reactive proxy for the Twig variable named `name`
 * @property {(name?: string) => unknown} getSnapshot - deep-cloned scope data (or just one variable when `name` is given), identity tags stripped
 */

/**
 * Scope held on the parser stack while the closing comment hasn't been
 * seen yet. `endComment` and `data` are filled in as the walk proceeds;
 * once both are present the pending scope is narrowed to a ScopeDraft.
 *
 * @typedef {Object} ScopePending
 * @property {string} name
 * @property {Comment} startComment
 * @property {Comment|null} endComment
 * @property {Record<string, unknown>|null} data
 * @property {Binding[]} bindings
 */

/**
 * Scope captured during the DOM walk after the closing comment was found
 * (so `endComment` and `data` are non-null) but before refs are resolved
 * and the proxy/handle are built. The `refMap` is filled in by buildRefMap
 * during finalization.
 *
 * @typedef {Object} ScopeDraft
 * @property {string} name
 * @property {Comment} startComment
 * @property {Comment} endComment
 * @property {Record<string, unknown>} data
 * @property {Binding[]} bindings
 * @property {RefMap} refMap
 */

/**
 * Input bag for createScope(). Caller is responsible for resolving refs,
 * unifying identity, and building the refMap before finalization; createScope
 * adds the proxy and handle.
 *
 * @typedef {Object} ScopeInit
 * @property {string} name
 * @property {Comment} startComment
 * @property {Comment} endComment
 * @property {Record<string, unknown>} data
 * @property {Binding[]} bindings
 * @property {RefMap} refMap
 */
