/**
 * @typedef {Object} Binding
 * @property {HTMLElement} element
 * @property {string} path - dot-separated data path, e.g. "user.address.city"
 * @property {string} target - "text" | "value" | any attribute name
 */

/**
 * @typedef {Object} Alias
 * @property {Scope|null} scope - null means same scope
 * @property {string} path
 */

/**
 * @typedef {Object.<string, Alias[]>} RefMap
 * Keys are dot-paths; values are the aliased locations for that path.
 */

/**
 * @typedef {Object} Scope
 * @property {string} name - scope identifier (template path in debug, sha256 prefix in prod)
 * @property {Record<string, unknown>} data - deserialized wire bootstrap JSON, refs resolved
 * @property {Binding[]} bindings
 * @property {RefMap} refMap
 * @property {Comment} startComment
 * @property {Comment} endComment
 * @property {Record<string, unknown>} proxy - reactive Proxy wrapping data
 */
