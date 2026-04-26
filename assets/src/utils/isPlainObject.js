/**
 * Return true when `value` is a non-null, non-array plain object.
 * The type predicate narrows `value` to `Record<string, unknown>` so callers
 * get full index-signature access without expression casts.
 *
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
