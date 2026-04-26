/** @import { ScopeSnapshot, ScopeBindings } from '../../src/types.js' */

import { describe, it, expect } from 'vitest';
import { resolveRefs, buildRefMap, buildCrossScopeRefs } from '../../src/refs.js';

describe('resolveRefs', () => {
    it('resolves a local $ref by dot-path', () => {
        const shared = { city: 'Berlin' };
        const data = { home: shared, office: { '$ref': 'home' } };

        resolveRefs(data, []);

        expect(data.office).toBe(shared);
    });

    it('resolves a cross-scope $ref', () => {
        const address = { city: 'Munich' };
        /** @type {ScopeSnapshot} */
        const scope1 = { name: 'scope1', data: { address } };
        const data = { location: { '$ref': 'scope1#address' } };

        resolveRefs(data, [scope1]);

        expect(data.location).toBe(address);
    });

    it('ignores a cross-scope $ref when the scope does not exist', () => {
        const data = { location: { '$ref': 'unknown#address' } };

        resolveRefs(data, []);

        expect(data.location).toEqual({ '$ref': 'unknown#address' });
    });

    it('recurses into nested objects without $ref', () => {
        const shared = { city: 'Hamburg' };
        const data = { user: { home: shared, office: { '$ref': 'user.home' } } };

        resolveRefs(data, []);

        expect(data.user.office).toBe(shared);
    });

    it('skips non-object values', () => {
        const data = { name: 'Jason', count: 42, flag: true };

        expect(() => resolveRefs(data, [])).not.toThrow();
        expect(data.name).toBe('Jason');
    });
});

describe('buildRefMap', () => {
    it('returns an empty map when no objects are shared', () => {
        const data = { a: { x: 1 }, b: { y: 2 } };

        expect(buildRefMap(data)).toEqual({});
    });

    it('records aliases when the same object appears at two paths', () => {
        const shared = { city: 'Berlin' };
        const data = { home: shared, office: shared };
        const refMap = buildRefMap(data);

        expect(refMap['home']).toBeDefined();
        expect(refMap['office']).toBeDefined();
    });
});

describe('buildCrossScopeRefs', () => {
    it('adds cross-scope alias when the same object appears in two scopes', () => {
        const shared = { city: 'Berlin' };
        /** @type {ScopeBindings} */
        const scope1 = { data: { address: shared }, bindings: [], refMap: {} };
        /** @type {ScopeBindings} */
        const scope2 = { data: { location: shared }, bindings: [], refMap: {} };

        buildCrossScopeRefs([scope1, scope2]);

        expect(scope1.refMap['address']).toBeDefined();
        expect(scope2.refMap['location']).toBeDefined();
    });

    it('does not add self-aliases', () => {
        const obj = { city: 'Berlin' };
        /** @type {ScopeBindings} */
        const scope1 = { data: { address: obj }, bindings: [], refMap: {} };

        buildCrossScopeRefs([scope1]);

        expect(scope1.refMap['address']).toBeUndefined();
    });
});
