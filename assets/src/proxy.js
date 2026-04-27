import { updateBindings } from './bindings.js';
import { stripIdentityTags } from './identity.js';
import { deepClone } from './utils/deepClone.js';
import { deepEqual } from './utils/deepEqual.js';
import { addListener, appendHistory, fireListeners, getEntry, getHistory, identityKey, mergeResponse } from './entityRegistry.js';
import { Scope } from './scope.js';

/**
 * Wrap `data` in a recursive Proxy that triggers DOM binding updates on every
 * property assignment.
 *
 * Reserved `$`-prefixed methods on every proxy:
 *
 * - `$getType()`     — opaque entity type token (`__wire.type`), or undefined
 * - `$getId()`       — entity identifier (`__wire.id`), or undefined
 * - `$getSnapshot()` — fresh deep clone of this object with identity tags stripped
 * - `$isDirty()`     — true if current state differs from the last server-confirmed snapshot
 * - `$revert()`      — restore fields to the last server-confirmed snapshot
 * - `$on(callback)` / `$on(path, callback)` — subscribe to entity changes; returns unsubscribe
 *
 * `$isDirty`, `$revert`, and `$on` are no-ops on non-entity proxies (no `__wire` identity).
 *
 * The `$` prefix is reserved; entity field names beginning with `$` are not supported.
 *
 * @param {Record<string, unknown>} data
 * @param {Scope} scope
 * @param {string} [path] - dot-path prefix for this proxy level (relative to scope root)
 * @param {Record<string, unknown>|null} [entityOwner] - nearest enclosing entity target
 * @param {string} [entityPath] - dot-path of this level relative to the entity owner
 * @returns {Record<string, unknown>}
 */
export function makeProxy(data, scope, path = '', entityOwner = null, entityPath = '') {
    const owner = identityKey(data) !== null ? data : entityOwner;
    const ownerPath = owner === data ? '' : entityPath;

    return new Proxy(data, {
        get(target, key) {
            if (key === '$getSnapshot') {
                return () => stripIdentityTags(deepClone(target));
            }

            if (key === '$getType') {
                return () => target['__wire']?.type;
            }

            if (key === '$getId') {
                return () => target['__wire']?.id;
            }

            if (key === '$isDirty') {
                return () => isDirty(target);
            }

            if (key === '$revert') {
                return () => revert(target, scope, path);
            }

            if (key === '$on') {
                return (...args) => onListener(target, args);
            }

            if (key === '$update') {
                return (options) => update(target, options);
            }

            if (key === '$read') {
                return (options) => read(target, options);
            }

            if (key === '$getHistory') {
                return () => getHistory(target);
            }

            const value = target[key];

            if (value !== null && typeof value === 'object') {
                return makeProxy(
                    value,
                    scope,
                    path ? `${path}.${key}` : key,
                    owner,
                    ownerPath ? `${ownerPath}.${key}` : key,
                );
            }

            return value;
        },
        set(target, key, value) {
            const oldValue = deepClone(target[key]);
            target[key] = value;

            const fullPath = path ? `${path}.${key}` : key;
            updateBindings(scope, fullPath);

            if (owner !== null) {
                const relPath = ownerPath ? `${ownerPath}.${key}` : key;
                fireListeners(owner, relPath, value, oldValue);
            }

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
        if (touched.has(key) || key === '__wire' || key === '__read' || key === '__update') {
            continue;
        }
        delete target[key];
        updateBindings(scope, path ? `${path}.${key}` : key);
    }
}

/**
 * @param {Record<string, unknown>} target
 * @param {unknown[]} args
 */
function onListener(target, args) {
    if (identityKey(target) === null) {
        return () => {};
    }

    let path;
    let callback;

    if (args.length === 1 && typeof args[0] === 'function') {
        callback = args[0];
    } else if (args.length >= 2 && typeof args[0] === 'string' && typeof args[1] === 'function') {
        path     = args[0];
        callback = args[1];
    } else {
        throw new TypeError('$on expects (callback) or (path, callback).');
    }

    return addListener(target, { path, callback });
}

/**
 * @param {Record<string, unknown>} target
 * @param {{ method?: string, url?: string, headers?: Record<string,string> } | undefined} options
 * @returns {Promise<unknown>}
 */
async function update(target, options = {}) {
    if (identityKey(target) === null) {
        throw new Error('$update: entity has no __wire identity; identity-less proxies cannot round-trip.');
    }

    const config = target['__update'];
    if (!config || typeof config.url !== 'string' || typeof config.method !== 'string') {
        throw new Error('$update: entity has no __update endpoint; declare #[Wire(updateRouteName: ...)] on the class.');
    }

    const url     = options.url     ?? config.url;
    const method  = options.method  ?? config.method;
    const headers = { 'Content-Type': 'application/json', ...(options.headers ?? {}) };
    const body    = JSON.stringify(stripIdentityTags(deepClone(target)));

    const response = await fetch(url, { method, headers, body });

    if (!response.ok) {
        const error = new Error(`$update: server responded ${response.status}`);
        error.status   = response.status;
        error.response = response;
        throw error;
    }

    const text = await response.text();
    if (text.length === 0) {
        return null;
    }

    const payload = JSON.parse(text);
    mergeResponse(payload);
    appendHistory(target, 'update');
    return payload;
}

/**
 * @param {Record<string, unknown>} target
 * @param {{ method?: string, url?: string, headers?: Record<string,string>, force?: boolean } | undefined} options
 * @returns {Promise<unknown>}
 */
async function read(target, options = {}) {
    if (identityKey(target) === null) {
        throw new Error('$read: entity has no __wire identity; identity-less proxies cannot round-trip.');
    }

    const config = target['__read'];
    if (!config || typeof config.url !== 'string' || typeof config.method !== 'string') {
        throw new Error('$read: entity has no __read endpoint; declare #[Wire(readRouteName: ...)] on the class.');
    }

    if (!options.force && isDirty(target)) {
        throw new Error('$read: entity has unsaved local edits; pass { force: true } to overwrite.');
    }

    const url     = options.url     ?? config.url;
    const method  = options.method  ?? config.method;
    const headers = { ...(options.headers ?? {}) };

    const response = await fetch(url, { method, headers });

    if (!response.ok) {
        const error = new Error(`$read: server responded ${response.status}`);
        error.status   = response.status;
        error.response = response;
        throw error;
    }

    const text = await response.text();
    if (text.length === 0) {
        return null;
    }

    const payload = JSON.parse(text);
    mergeResponse(payload);
    appendHistory(target, 'read');
    return payload;
}
