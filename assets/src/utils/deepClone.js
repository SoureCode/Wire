/**
 * Recursively deep-clone a value, returning `null` for circular references.
 *
 * @param {unknown} obj
 * @param {WeakSet<object>} [seen]
 * @returns {unknown}
 */
export function deepClone(obj, seen = new WeakSet()) {
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
