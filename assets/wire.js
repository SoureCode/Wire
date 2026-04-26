import { parseScopes, setupMutationObserver } from './src/dom.js';
import { snapshot as snapshotScopes } from './src/snapshot.js';
import { stripIdentityTags } from './src/identity.js';
import { deepClone } from './src/utils/deepClone.js';

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
 * Return a deep-cloned snapshot of one or all scope data trees, with all
 * identity tags stripped.
 *
 * @param {string} [name]
 * @returns {Array<{scope: string, data: unknown}>|unknown|null}
 */
export function snapshot(name) {
    return snapshotScopes(scopes, name);
}

/**
 * Submit an identified value (entity proxy) to its server-side route.
 *
 * The value must carry a `__submit` URL emitted at render time from a
 * Doctrine-managed entity decorated with `#[Wire(submit: 'route_name')]`.
 * Identity tags are stripped from the payload before sending.
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
