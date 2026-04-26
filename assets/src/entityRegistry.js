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
    registry.set(key, {
        canonical,
        baseline: stripIdentityTags(deepClone(canonical)),
        history: [],
    });
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
