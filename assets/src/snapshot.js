/** @import { ScopeSnapshot } from './types.js' */

import { deepClone } from './utils/deepClone.js';
import { stripIdentityTags } from './identity.js';

/**
 * Return a deep-cloned snapshot of one or all scope data trees, with all
 * `__class` / `__id` / `__submit` identity tags stripped — the result is the
 * pure user-visible data shape, suitable for posting back to the server.
 *
 * @param {ScopeSnapshot[]} scopes
 * @param {string} [name] - scope name; omit to snapshot all scopes
 * @returns {Array<{scope: string, data: unknown}>|unknown|null}
 */
export function snapshot(scopes, name) {
    if (name === undefined) {
        return scopes.map(scope => ({ scope: scope.name, data: stripIdentityTags(deepClone(scope.data)) }));
    }

    const found = scopes.find(scope => scope.name === name);

    if (!found) {
        return null;
    }

    return stripIdentityTags(deepClone(found.data));
}
