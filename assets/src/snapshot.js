/** @import { ScopeSnapshot } from './types.js' */

import { deepClone } from './utils/deepClone.js';

/**
 * Return a deep-cloned snapshot of one or all scope data trees.
 * The clone is decoupled from the live proxy — mutations to the snapshot do
 * not affect the reactive state.
 *
 * @param {ScopeSnapshot[]} scopes
 * @param {string} [name] - scope name; omit to snapshot all scopes
 * @returns {Array<{scope: string, data: unknown}>|unknown|null}
 */
export function snapshot(scopes, name) {
    if (name === undefined) {
        return scopes.map(scope => ({ scope: scope.name, data: deepClone(scope.data) }));
    }

    const found = scopes.find(scope => scope.name === name);

    if (!found) {
        return null;
    }

    return deepClone(found.data);
}
