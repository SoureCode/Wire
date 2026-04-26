import { parseScopes, setupMutationObserver } from './src/dom.js';
import { findScopeFor } from './src/scope.js';

/** @import { ScopeHandle } from './src/types.js' */

/**
 * Initialise Wire: parse all scopes in the current document and start
 * observing for dynamically added elements.
 */
export function init() {
    parseScopes();
    setupMutationObserver();
}

/**
 * Return the scope handle for the scope containing `element`.
 * `scope.get('user')` returns the reactive proxy for the Twig variable `user`.
 *
 * @param {Element} element
 * @returns {ScopeHandle|null}
 */
export function getScope(element) {
    return findScopeFor(element)?.handle ?? null;
}

document.addEventListener('DOMContentLoaded', () => init());
