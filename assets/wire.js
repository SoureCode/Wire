import { parseScopes, setupMutationObserver } from './src/dom.js';
import { snapshot as snapshotScopes } from './src/snapshot.js';

/** @import { Scope } from './src/types.js' */

/** @type {Scope[]} */
const scopes = [];

/**
 * Initialise Wire: parse all scopes in the current document and start
 * observing for dynamically added elements.
 *
 * @returns {void}
 */
export function init() {
    parseScopes(scopes);
    setupMutationObserver(scopes);
}

/**
 * Return the reactive proxy for the nth scope with the given name.
 *
 * @param {string} name
 * @param {number} [index]
 * @returns {Record<string, unknown>|undefined}
 */
export function get(name, index = 0) {
    return scopes.filter(scope => scope.name === name)[index]?.proxy;
}

/**
 * Return reactive proxies for every scope matching `name`.
 *
 * @param {string} name
 * @returns {Array<Record<string, unknown>>}
 */
export function getAll(name) {
    return scopes.filter(scope => scope.name === name).map(scope => scope.proxy);
}

/**
 * Return a deep-cloned snapshot of one or all scope data trees.
 *
 * @param {string} [name]
 * @returns {Array<{scope: string, data: unknown}>|unknown|null}
 */
export function snapshot(name) {
    return snapshotScopes(scopes, name);
}

document.addEventListener('DOMContentLoaded', () => init());
