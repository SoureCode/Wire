/** @import { Scope } from './types.js' */

/**
 * Recursively deep-clone a value, returning `null` for circular references.
 *
 * @param {unknown} obj
 * @param {WeakSet<object>} [seen]
 * @returns {unknown}
 */
function deepClone(obj, seen = new WeakSet()) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    if (seen.has(obj)) {
        return null;
    }

    seen.add(obj);

    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item, seen));
    }

    const result = {};

    for (const key of Object.keys(obj)) {
        result[key] = deepClone(obj[key], seen);
    }

    return result;
}

/**
 * Return a deep-cloned snapshot of one or all scope data trees.
 * The clone is decoupled from the live proxy — mutations to the snapshot do
 * not affect the reactive state.
 *
 * @param {Scope[]} scopes
 * @param {string} [name] - scope name; omit to snapshot all scopes
 * @returns {Array<{scope: string, data: unknown}>|unknown|null}
 */
export function snapshot(scopes, name) {
    if (name === undefined) {
        return scopes.map(scope => ({scope: scope.name, data: deepClone(scope.data)}));
    }

    const found = scopes.find(scope => scope.name === name);

    if (!found) {
        return null;
    }

    return deepClone(found.data);
}
