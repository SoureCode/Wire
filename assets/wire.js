import { parseScopes, setupMutationObserver } from './src/dom.js';
import { snapshot } from './src/snapshot.js';

/** @type {import('./src/types.js').Scope[]} */
const scopes = [];

/**
 * Initialise Wire: parse all scopes in the current document and start
 * observing for dynamically added elements.
 *
 * @returns {void}
 */
function init() {
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
function get(name, index = 0) {
    return scopes.filter(scope => scope.name === name)[index]?.proxy;
}

/**
 * Return reactive proxies for every scope matching `name`.
 *
 * @param {string} name
 * @returns {Array<Record<string, unknown>>}
 */
function getAll(name) {
    return scopes.filter(scope => scope.name === name).map(scope => scope.proxy);
}

document.addEventListener('DOMContentLoaded', () => init());

export const Wire = {
    init,
    scopes,
    get,
    getAll,
    /** @param {string} [name] */
    snapshot: (name) => snapshot(scopes, name),
};
