import { describe, it, expect } from 'vitest';
import { resolvePath } from '../../src/path.js';

describe('resolvePath', () => {
    it('returns the object itself when path is empty', () => {
        const obj = { a: 1 };

        expect(resolvePath(obj, '')).toBe(obj);
    });

    it('resolves a single key', () => {
        expect(resolvePath({ name: 'Jason' }, 'name')).toBe('Jason');
    });

    it('resolves a nested path', () => {
        const obj = { user: { address: { city: 'Berlin' } } };

        expect(resolvePath(obj, 'user.address.city')).toBe('Berlin');
    });

    it('returns undefined for a missing top-level key', () => {
        expect(resolvePath({}, 'missing')).toBeUndefined();
    });

    it('returns undefined when an intermediate key is missing', () => {
        expect(resolvePath({ user: {} }, 'user.address.city')).toBeUndefined();
    });

    it('returns undefined when an intermediate value is null', () => {
        expect(resolvePath({ user: null }, 'user.name')).toBeUndefined();
    });

    it('returns undefined when an intermediate value is a primitive', () => {
        expect(resolvePath({ user: 'string' }, 'user.name')).toBeUndefined();
    });
});
