/** @import { Scope, RefMap } from './types.js' */

import { resolvePath } from './path.js';
import { isPlainObject } from './utils/isPlainObject.js';

/**
 * Walk `data` in-place, replacing every `{ $ref }` placeholder with the
 * actual value it points to — either within `root` (local ref) or in another
 * scope (cross-scope ref identified by "scopeName#path").
 *
 * @param {Record<string, unknown>} data - object to resolve in-place
 * @param {Scope[]} scopes - all registered scopes (needed for cross-scope refs)
 * @param {Record<string, unknown>} [root] - root of the current scope's data tree
 * @returns {Record<string, unknown>}
 */
export function resolveRefs(data, scopes, root = data) {
    for (const key of Object.keys(data)) {
        const value = data[key];

        if (!isPlainObject(value)) {
            continue;
        }

        if ('$ref' in value && typeof value['$ref'] === 'string') {
            const ref = value['$ref'];

            if (ref.includes('#')) {
                const [scopeName, path] = ref.split('#');
                const refScope = scopes.find(scope => scope.name === scopeName);

                if (refScope) {
                    data[key] = resolvePath(refScope.data, path);
                }
            } else {
                data[key] = resolvePath(root, ref);
            }
        } else {
            resolveRefs(value, scopes, root);
        }
    }

    return data;
}

/**
 * Build an intra-scope ref map from a resolved data tree.
 * When the same object instance appears at multiple paths, each path gets
 * an entry pointing to its aliases.
 *
 * @param {Record<string, unknown>} data
 * @returns {RefMap}
 */
export function buildRefMap(data) {
    /** @type {Map<object, string>} */
    const seen = new Map();

    /** @type {RefMap} */
    const refMap = {};

    /**
     * @param {unknown} obj
     * @param {string} path
     */
    function walk(obj, path) {
        if (!isPlainObject(obj)) {
            return;
        }

        if (seen.has(obj)) {
            const original = seen.get(obj);

            if (!refMap[original]) {
                refMap[original] = [];
            }

            if (!refMap[path]) {
                refMap[path] = [];
            }

            refMap[original].push({ scope: null, path });
            refMap[path].push({ scope: null, path: original });

            return;
        }

        seen.set(obj, path);

        for (const key of Object.keys(obj)) {
            walk(obj[key], path ? `${path}.${key}` : key);
        }
    }

    walk(data, '');

    return refMap;
}

/**
 * Extend every scope's refMap with cross-scope aliases.
 * When the same JS object is referenced in multiple scopes, Wire must keep
 * those in sync — this builds the necessary alias entries.
 *
 * @param {Scope[]} scopes
 * @returns {void}
 */
export function buildCrossScopeRefs(scopes) {
    /** @type {WeakMap<object, Array<{scope: Scope, path: string}>>} */
    const objectToEntries = new WeakMap();

    for (const scope of scopes) {
        /**
         * @param {unknown} obj
         * @param {string} path
         */
        function register(obj, path) {
            if (!isPlainObject(obj)) {
                return;
            }

            if (!objectToEntries.has(obj)) {
                objectToEntries.set(obj, []);
            }

            objectToEntries.get(obj).push({ scope, path });

            for (const key of Object.keys(obj)) {
                register(obj[key], path ? `${path}.${key}` : key);
            }
        }

        register(scope.data, '');
    }

    for (const scope of scopes) {
        /**
         * @param {unknown} obj
         * @param {string} path
         */
        function addAliases(obj, path) {
            if (!isPlainObject(obj)) {
                return;
            }

            const entries = objectToEntries.get(obj) || [];

            for (const { scope: otherScope, path: otherPath } of entries) {
                if (otherScope === scope) {
                    continue;
                }

                if (!scope.refMap[path]) {
                    scope.refMap[path] = [];
                }

                scope.refMap[path].push({ scope: otherScope, path: otherPath });
            }

            for (const key of Object.keys(obj)) {
                addAliases(obj[key], path ? `${path}.${key}` : key);
            }
        }

        addAliases(scope.data, '');
    }
}
