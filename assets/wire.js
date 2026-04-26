import { parseScopes, setupMutationObserver } from './src/dom.js';
import { findScopeFor } from './src/scope.js';
import { stripIdentityTags } from './src/identity.js';
import { deepClone } from './src/utils/deepClone.js';

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

/**
 * Submit an entity proxy to its server-side route.
 *
 * @param {Record<string, unknown>} value - a proxy or plain object carrying `__submit`
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
export function submit(value, options = {}) {
    const submit = value?.['__submit'];

    if (!submit || typeof submit.url !== 'string') {
        throw new Error('Wire.submit: value has no __submit — entity not annotated with #[Wire(submit: ...)] or not a managed entity');
    }

    const { url: overrideUrl, method: overrideMethod, headers: overrideHeaders, ...rest } = options;
    const payload = stripIdentityTags(deepClone(value));

    return fetch(overrideUrl ?? submit.url, {
        method: overrideMethod ?? submit.method,
        ...rest,
        headers: { 'Content-Type': 'application/json', ...(overrideHeaders || {}) },
        body: JSON.stringify(payload),
    });
}

document.addEventListener('DOMContentLoaded', () => init());
