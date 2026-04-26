import { describe, it, expect } from 'vitest';
import { deepClone } from '../../../src/utils/deepClone.js';

describe('deepClone', () => {
    it('clones a flat object', () => {
        const original = { a: 1, b: 'hello' };
        const clone = deepClone(original);

        expect(clone).toEqual(original);
        expect(clone).not.toBe(original);
    });

    it('clones a nested object', () => {
        const original = { user: { name: 'Jason', address: { city: 'Berlin' } } };
        const clone = deepClone(original);

        expect(clone).toEqual(original);
        expect(clone.user).not.toBe(original.user);
        expect(clone.user.address).not.toBe(original.user.address);
    });

    it('clones an array', () => {
        const original = [1, 2, { x: 3 }];
        const clone = deepClone(original);

        expect(clone).toEqual(original);
        expect(clone).not.toBe(original);
    });

    it('returns primitives as-is', () => {
        expect(deepClone(42)).toBe(42);
        expect(deepClone('hello')).toBe('hello');
        expect(deepClone(null)).toBe(null);
    });

    it('returns null for circular references instead of throwing', () => {
        const obj = { a: 1 };
        obj.self = obj;

        const clone = deepClone(obj);

        expect(clone.a).toBe(1);
        expect(clone.self).toBeNull();
    });

    it('mutations to the clone do not affect the original', () => {
        const original = { user: { name: 'Jason' } };
        const clone = deepClone(original);

        clone.user.name = 'Other';

        expect(original.user.name).toBe('Jason');
    });
});
