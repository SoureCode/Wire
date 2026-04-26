import { stripIdentityTags } from './identity.js';
import { deepClone } from './utils/deepClone.js';
import { isPlainObject } from './utils/isPlainObject.js';
import { updateBindings } from './bindings.js';

/**
 * Per-entity bookkeeping keyed by identity (`${__class}#${JSON.stringify(__id)}`).
 *
 * Holds:
 * - `canonical` — the JS object shared by every scope after unification.
 * - `baseline`  — a clone of the last server-confirmed state (no identity tags).
 *                  Compared by `$isDirty` and restored by `$revert`.
 * - `history`   — chronological list of server round-trip events (added in S8).
 *
 * In-memory only. Reset on every `Wire.init()` invocation via `clearRegistry()`.
 */
const registry = new Map();

/**
 * @param {Record<string, unknown>} target
 * @returns {string|null}
 */
export function identityKey(target) {
    if (target === null || typeof target !== 'object') {
        return null;
    }
    if (typeof target['__class'] !== 'string' || !('__id' in target)) {
        return null;
    }
    return `${target['__class']}#${JSON.stringify(target['__id'])}`;
}

/**
 * Register a canonical entity object and snapshot its baseline.
 * Idempotent: subsequent calls for the same identity reset the baseline
 * to the current canonical state.
 *
 * @param {Record<string, unknown>} canonical
 */
export function registerEntity(canonical) {
    const key = identityKey(canonical);
    if (key === null) {
        return;
    }
    const existing = registry.get(key);
    registry.set(key, {
        canonical,
        baseline: stripIdentityTags(deepClone(canonical)),
        history: existing?.history ?? [],
        listeners: existing?.listeners ?? new Set(),
        presence: existing?.presence ?? [],
    });
}

/**
 * Walk a scope's data tree and record the path at which each registered
 * entity appears. Called once per scope during init so that later identity
 * merges can refresh the right DOM bindings.
 *
 * @param {{ data: Record<string, unknown>, bindings: Array<unknown>, refMap: Record<string, unknown> }} scope
 */
export function registerScopePresence(scope) {
    walk(scope.data, '', scope);
}

/**
 * @param {unknown} value
 * @param {string} path
 * @param {object} scope
 */
function walk(value, path, scope) {
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            walk(value[i], path ? `${path}.${i}` : String(i), scope);
        }
        return;
    }
    if (!isPlainObject(value)) {
        return;
    }
    const entry = getEntry(value);
    if (entry !== undefined && !entry.presence.some(p => p.scope === scope && p.path === path)) {
        entry.presence.push({ scope, path });
    }
    for (const key of Object.keys(value)) {
        walk(value[key], path ? `${path}.${key}` : key, scope);
    }
}

/**
 * Merge a server payload into the canonical entity by identity, refresh
 * the baseline, and re-render every scope that holds this entity.
 * Returns the changed field names.
 *
 * @param {Record<string, unknown>} payload
 * @returns {string[]} changed field names
 */
export function mergeIntoEntity(payload) {
    const entry = getEntry(payload);
    if (entry === undefined) {
        return [];
    }

    const changed = [];
    for (const key of Object.keys(payload)) {
        if (key === '__class' || key === '__id' || key === '__submit' || key === '__read' || key === '__update') {
            continue;
        }
        entry.canonical[key] = payload[key];
        changed.push(key);
    }

    for (const { scope, path } of entry.presence) {
        for (const key of changed) {
            updateBindings(scope, path ? `${path}.${key}` : key);
        }
    }

    entry.baseline = stripIdentityTags(deepClone(entry.canonical));
    return changed;
}

/**
 * Apply a server response to the registry. Accepts a single tagged payload
 * or an array of tagged payloads. Returns the list of identity keys that
 * were merged.
 *
 * @param {unknown} response
 * @returns {string[]}
 */
export function mergeResponse(response) {
    const merged = [];
    const list   = Array.isArray(response) ? response : [response];

    for (const item of list) {
        if (!isPlainObject(item)) {
            continue;
        }
        const key = identityKey(item);
        if (key === null) {
            continue;
        }
        mergeIntoEntity(item);
        merged.push(key);
    }

    return merged;
}

/**
 * Append a history record on the entity's entry. Called after a successful
 * server round-trip ($read or $update). No-op for non-entity targets.
 *
 * @param {Record<string, unknown>} target
 * @param {'read'|'update'} op
 */
export function appendHistory(target, op) {
    const entry = getEntry(target);
    if (entry === undefined) {
        return;
    }
    entry.history.push({
        timestamp: Date.now(),
        op,
        snapshot: stripIdentityTags(deepClone(entry.canonical)),
    });
}

/**
 * @param {Record<string, unknown>} target
 * @returns {Array<{ timestamp: number, op: string, snapshot: Record<string,unknown> }>}
 */
export function getHistory(target) {
    const entry = getEntry(target);
    return entry === undefined ? [] : entry.history.slice();
}

/**
 * @param {Record<string, unknown>} target
 * @param {{ path?: string, callback: Function }} listener
 * @returns {() => void} unsubscribe
 */
export function addListener(target, listener) {
    const entry = getEntry(target);
    if (entry === undefined) {
        return () => {};
    }
    entry.listeners.add(listener);
    return () => entry.listeners.delete(listener);
}

/**
 * Fire all listeners on the entity that match the given relative path.
 * A listener with no path matches everything; a listener with path `p`
 * matches when relativePath === p OR relativePath starts with `p.`.
 *
 * @param {Record<string, unknown>} entityTarget
 * @param {string} relativePath
 * @param {unknown} newValue
 * @param {unknown} oldValue
 */
export function fireListeners(entityTarget, relativePath, newValue, oldValue) {
    const entry = getEntry(entityTarget);
    if (entry === undefined) {
        return;
    }
    for (const listener of entry.listeners) {
        if (listener.path !== undefined && !pathMatches(relativePath, listener.path)) {
            continue;
        }
        listener.callback(newValue, oldValue, relativePath);
    }
}

/**
 * @param {string} relativePath
 * @param {string} listenerPath
 * @returns {boolean}
 */
function pathMatches(relativePath, listenerPath) {
    return relativePath === listenerPath || relativePath.startsWith(listenerPath + '.');
}

/**
 * @param {Record<string, unknown>} target
 * @returns {{canonical: Record<string, unknown>, baseline: Record<string, unknown>, history: Array<unknown>} | undefined}
 */
export function getEntry(target) {
    const key = identityKey(target);
    if (key === null) {
        return undefined;
    }
    return registry.get(key);
}

/**
 * Replace the baseline with a fresh clone of the canonical state.
 * Called after a successful $read or $update.
 *
 * @param {Record<string, unknown>} target
 */
export function refreshBaseline(target) {
    const entry = getEntry(target);
    if (entry === undefined) {
        return;
    }
    entry.baseline = stripIdentityTags(deepClone(entry.canonical));
}

/**
 * Drop all registry state. Called by `Wire.init()` before re-scanning the DOM.
 */
export function clearRegistry() {
    registry.clear();
}
