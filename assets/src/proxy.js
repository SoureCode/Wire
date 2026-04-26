import { updateBindings } from './bindings.js';
import { stripIdentityTags } from './identity.js';
import { deepClone } from './utils/deepClone.js';
import { Scope } from './scope.js';

/**
 * Wrap `data` in a recursive Proxy that triggers DOM binding updates on every
 * property assignment.
 *
 * Reserved `$`-prefixed methods exposed on every proxy:
 *
 * - `$getClass()`    — entity class token (`__class`), or undefined
 * - `$getId()`       — entity identifier (`__id`), or undefined
 * - `$getSnapshot()` — fresh deep clone of this object with identity tags stripped
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
