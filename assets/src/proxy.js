/** @import { ScopeBindings } from './types.js' */

import { updateBindings } from './bindings.js';

/**
 * Wrap `data` in a recursive Proxy that triggers DOM binding updates on every
 * property assignment.
 *
 * @param {Record<string, unknown>} data
 * @param {ScopeBindings} scope
 * @param {string} [path] - dot-path prefix for this proxy level
 * @returns {Record<string, unknown>}
 */
export function makeProxy(data, scope, path = '') {
    return new Proxy(data, {
        get(target, key) {
            const value = target[key];

            if (value !== null && typeof value === 'object') {
                return makeProxy(value, scope, path ? `${path}.${key}` : key);
            }

            return value;
        },
        set(target, key, value) {
            target[key] = value;

            const fullPath = path ? `${path}.${key}` : key;

            updateBindings(scope, fullPath);

            return true;
        },
    });
}
