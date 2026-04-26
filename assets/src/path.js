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
