import { describe, it, expect, beforeEach } from 'vitest';
import {
    clearRegistry,
    getEntry,
    identityKey,
    refreshBaseline,
    registerEntity,
} from '../../src/entityRegistry.js';

describe('entityRegistry', () => {
    beforeEach(() => clearRegistry());

    it('identityKey returns null for non-entity targets', () => {
        expect(identityKey({ name: 'x' })).toBeNull();
        expect(identityKey({ __wire: { type: 'X' } })).toBeNull();
        expect(identityKey(null)).toBeNull();
    });

    it('identityKey composes wire type and id', () => {
        expect(identityKey({ __wire: { type: 'User', id: 42 } })).toBe('User#42');
        expect(identityKey({ __wire: { type: 'C', id: { a: 1 } } })).toBe('C#{"a":1}');
    });

    it('registerEntity stores baseline without identity tags', () => {
        const canonical = { __wire: { type: 'User', id: 1 }, name: 'Alice', __read: { url: '/x', method: 'GET' } };
        registerEntity(canonical);

        const entry = getEntry(canonical);
        expect(entry).toBeDefined();
        expect(entry.canonical).toBe(canonical);
        expect(entry.baseline).toEqual({ name: 'Alice' });
        expect(entry.history).toEqual([]);
    });

    it('refreshBaseline replaces baseline with current canonical state', () => {
        const canonical = { __wire: { type: 'User', id: 1 }, name: 'Alice' };
        registerEntity(canonical);

        canonical.name = 'Bob';
        refreshBaseline(canonical);

        expect(getEntry(canonical).baseline).toEqual({ name: 'Bob' });
    });

    it('clearRegistry drops all entries', () => {
        registerEntity({ __wire: { type: 'User', id: 1 }, name: 'Alice' });
        clearRegistry();
        expect(getEntry({ __wire: { type: 'User', id: 1 } })).toBeUndefined();
    });
});
