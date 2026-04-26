/**
 * @typedef {Object} Binding
 * @property {HTMLElement} element
 * @property {string} path - dot-separated data path, e.g. "user.address.city"
 * @property {string} target - "text" | "value" | any attribute name
 */

/**
 * Minimal shape required by buildCrossScopeRefs.
 *
 * @typedef {Object} ScopeRefs
 * @property {Record<string, unknown>} data
 * @property {RefMap} refMap
 */

/**
 * @typedef {Object} Alias
 * @property {ScopeRefs|null} scope - null means same scope
 * @property {string} path
 */

/**
 * @typedef {Object.<string, Alias[]>} RefMap
 * Keys are dot-paths; values are the aliased locations for that path.
 */

/**
 * Minimal shape required by snapshot.
 *
 * @typedef {Object} ScopeSnapshot
 * @property {string} name
 * @property {Record<string, unknown>} data
 */

/**
 * Minimal shape required by updateScopeBindings.
 *
 * @typedef {Object} ScopeData
 * @property {Record<string, unknown>} data
 * @property {Binding[]} bindings
 */

/**
 * Minimal shape required by updateBindings (adds refMap for alias propagation).
 *
 * @typedef {ScopeData & Object} ScopeBindings
 * @property {RefMap} refMap
 */

/**
 * Full scope object created by the DOM parser.
 *
 * @typedef {ScopeBindings & Object} Scope
 * @property {string} name - scope identifier (template path in debug, sha256 prefix in prod)
 * @property {Comment} startComment
 * @property {Comment} endComment
 * @property {Record<string, unknown>} proxy - reactive Proxy wrapping data
 */
