import { updateBindings } from './bindings.js';
import { stripIdentityTags } from './identity.js';
import { deepClone } from './utils/deepClone.js';
import { Scope } from './scope.js';

/**
 * Wrap `data` in a recursive Proxy that triggers DOM binding updates on every
 * property assignment. Every proxied object additionally exposes three
 * methods:
 *
 * - `getSnapshot()`  — fresh deep clone of this object with identity tags stripped
 * - `isEntity()`     — true iff this object carries `__class` + `__id`
 * - `getClass()`     — the entity class token (`__class`), or undefined
 * - `getId()`        — the entity identifier (`__id`), or undefined
 * - `getScope()`     — the ScopeHandle of the containing scope
 *
 * @param {Record<string, unknown>} data
 * @param {Scope} scope
 * @param {string} [path] - dot-path prefix for this proxy level
 * @returns {Record<string, unknown>}
 */
export function makeProxy(data, scope, path = '') {
    return new Proxy(data, {
        get(target, key) {
            if (key === 'getSnapshot') {
                return () => stripIdentityTags(deepClone(target));
            }

            if (key === 'isEntity') {
                return () => '__class' in target && '__id' in target;
            }

            if (key === 'getClass' && '__class' in target) {
                return () => target['__class'];
            }

            if (key === 'getId' && '__id' in target) {
                return () => target['__id'];
            }

            if (key === 'getScope') {
                return () => scope.handle;
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
