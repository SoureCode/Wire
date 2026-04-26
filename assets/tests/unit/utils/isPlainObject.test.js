import { describe, it, expect } from 'vitest';
import { isPlainObject } from '../../../src/utils/isPlainObject.js';

describe('isPlainObject', () => {
    it('returns true for a plain object', () => {
        expect(isPlainObject({ a: 1 })).toBe(true);
    });

    it('returns true for an empty object', () => {
        expect(isPlainObject({})).toBe(true);
    });

    it('returns false for null', () => {
        expect(isPlainObject(null)).toBe(false);
    });

    it('returns false for an array', () => {
        expect(isPlainObject([1, 2, 3])).toBe(false);
    });

    it('returns false for a string', () => {
        expect(isPlainObject('hello')).toBe(false);
    });

    it('returns false for a number', () => {
        expect(isPlainObject(42)).toBe(false);
    });

    it('returns false for undefined', () => {
        expect(isPlainObject(undefined)).toBe(false);
    });
});
