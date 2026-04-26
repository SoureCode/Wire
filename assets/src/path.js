/**
 * Resolve a dot-separated path against an object.
 *
 * @param {Record<string, unknown>} obj
 * @param {string} path - dot-separated key sequence, e.g. "user.address.city"
 * @returns {unknown}
 */
export function resolvePath(obj, path) {
    if (!path) {
        return obj;
    }

    return path.split('.').reduce((current, key) => {
        if (current === null || current === undefined) {
            return undefined;
        }

        if (typeof current !== 'object') {
            return undefined;
        }

        return current[key];
    }, obj);
}

/**
 * Return every dot-path a marker descriptor reads from. Used by the binding
 * update propagator to know which bindings react to a given path mutation.
 *
 * Descriptor shapes:
 *   { p: 'user.name' }                            → ['user.name']
 *   { p: 'user.name', f: [...] }                  → ['user.name']
 *   { parts: [{ l: '...' }, { p: 'user.name' }] } → ['user.name']
 *
 * @param {object} descriptor
 * @returns {string[]}
 */
export function extractPaths(descriptor) {
    if (descriptor.parts) {
        return descriptor.parts.flatMap(part => 'p' in part ? [part.p] : []);
    }
    return descriptor.p ? [descriptor.p] : [];
}
