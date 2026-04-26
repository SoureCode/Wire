import { stripIdentityTags } from './identity.js';
import { deepClone } from './utils/deepClone.js';

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
    });
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
