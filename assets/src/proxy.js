import { updateBindings } from './bindings.js';
import { stripIdentityTags } from './identity.js';
import { deepClone } from './utils/deepClone.js';
import { deepEqual } from './utils/deepEqual.js';
import { getEntry } from './entityRegistry.js';
import { Scope } from './scope.js';

/**
 * Wrap `data` in a recursive Proxy that triggers DOM binding updates on every
 * property assignment.
 *
 * Reserved `$`-prefixed methods on every proxy:
 *
 * - `$getClass()`    — entity class token (`__class`), or undefined
 * - `$getId()`       — entity identifier (`__id`), or undefined
 * - `$getSnapshot()` — fresh deep clone of this object with identity tags stripped
 * - `$isDirty()`     — true if current state differs from the last server-confirmed snapshot
 * - `$revert()`      — restore fields to the last server-confirmed snapshot
 *
 * `$isDirty` and `$revert` are no-ops on non-entity proxies (no `__id`).
 *
 * The `$` prefix is reserved; entity field names beginning with `$` are not supported.
 *
 * @param {Record<string, unknown>} data
 * @param {Scope} scope
 * @param {string} [path] - dot-path prefix for this proxy level
 * @returns {Record<string, unknown>}
 */
export function makeProxy(data, scope, path = '') {
    return new Proxy(data, {
        get(target, key) {
            if (key === '$getSnapshot') {
                return () => stripIdentityTags(deepClone(target));
            }

            if (key === '$getClass') {
                return () => target['__class'];
            }

            if (key === '$getId') {
                return () => target['__id'];
            }

            if (key === '$isDirty') {
                return () => isDirty(target);
            }

            if (key === '$revert') {
                return () => revert(target, scope, path);
            }

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

/**
 * @param {Record<string, unknown>} target
 */
function isDirty(target) {
    const entry = getEntry(target);
    if (entry === undefined) {
        return false;
    }
    return !deepEqual(stripIdentityTags(deepClone(target)), entry.baseline);
}

/**
 * @param {Record<string, unknown>} target
 * @param {Scope} scope
 * @param {string} path
 */
function revert(target, scope, path) {
    const entry = getEntry(target);
    if (entry === undefined) {
        return;
    }

    const baseline = entry.baseline;
    const touched  = new Set();

    for (const key of Object.keys(baseline)) {
        target[key] = deepClone(baseline[key]);
        touched.add(key);
        updateBindings(scope, path ? `${path}.${key}` : key);
    }

    for (const key of Object.keys(target)) {
        if (touched.has(key) || key === '__class' || key === '__id' || key === '__submit' || key === '__read' || key === '__update') {
            continue;
        }
        delete target[key];
        updateBindings(scope, path ? `${path}.${key}` : key);
    }
}
