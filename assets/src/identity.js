import { isPlainObject } from './utils/isPlainObject.js';

/**
 * Walk every scope's data tree and unify objects that share the same
 * `__class` + `__id` identity into a single canonical instance. After this
 * pass, identical entities across scopes share JS object identity, so the
 * existing cross-scope refMap picks them up automatically.
 *
 * Fields from later occurrences are merged into the canonical instance so
 * no data is lost when scopes expose different field subsets.
 *
 * @param {Array<{ data: Record<string, unknown> }>} scopes
 * @returns {Map<string, Record<string, unknown>>} identity → canonical object
 */
export function unifyByIdentity(scopes) {
    /** @type {Map<string, Record<string, unknown>>} */
    const identityMap = new Map();

    for (const scope of scopes) {
        scope.data = unify(scope.data, identityMap);
    }

    return identityMap;
}

/**
 * @param {unknown} value
 * @param {Map<string, Record<string, unknown>>} identityMap
 * @returns {unknown}
 */
function unify(value, identityMap) {
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            value[i] = unify(value[i], identityMap);
        }

        return value;
    }

    if (!isPlainObject(value)) {
        return value;
    }

    for (const key of Object.keys(value)) {
        value[key] = unify(value[key], identityMap);
    }

    if (typeof value['__class'] === 'string' && '__id' in value) {
        const key = `${value['__class']}#${JSON.stringify(value['__id'])}`;
        const existing = identityMap.get(key);

        if (existing) {
            for (const k of Object.keys(value)) {
                if (!(k in existing)) {
                    existing[k] = value[k];
                }
            }

            return existing;
        }

        identityMap.set(key, value);
    }

    return value;
}

/**
 * Return a deep-cloned copy of `value` with all `__class` / `__id` /
 * `__submit` keys stripped. Used when building the request payload for
 * `Wire.submit()`.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export function stripIdentityTags(value) {
    if (Array.isArray(value)) {
        return value.map(stripIdentityTags);
    }

    if (!isPlainObject(value)) {
        return value;
    }

    const out = {};

    for (const key of Object.keys(value)) {
        if (key === '__class' || key === '__id' || key === '__submit') {
            continue;
        }

        out[key] = stripIdentityTags(value[key]);
    }

    return out;
}
