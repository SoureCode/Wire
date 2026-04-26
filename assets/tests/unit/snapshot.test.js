import { describe, it, expect } from 'vitest';
import { snapshot } from '../../src/snapshot.js';

function makeScope(name, data) {
    return { name, data };
}

describe('snapshot', () => {
    it('returns a deep clone of a named scope', () => {
        const data = { user: { name: 'Jason' } };
        const scopes = [makeScope('main', data)];
        const result = snapshot(scopes, 'main');

        expect(result).toEqual(data);
        expect(result).not.toBe(data);
        expect(result.user).not.toBe(data.user);
    });

    it('returns null for an unknown scope name', () => {
        expect(snapshot([], 'missing')).toBeNull();
    });

    it('returns an array of all scopes when name is omitted', () => {
        const scopes = [
            makeScope('a', { x: 1 }),
            makeScope('b', { y: 2 }),
        ];
        const result = snapshot(scopes);

        expect(result).toHaveLength(2);
        expect(result[0].scope).toBe('a');
        expect(result[1].scope).toBe('b');
    });

    it('mutations to the snapshot do not affect the original data', () => {
        const data = { user: { name: 'Jason' } };
        const scopes = [makeScope('main', data)];
        const result = snapshot(scopes, 'main');

        result.user.name = 'Other';

        expect(data.user.name).toBe('Jason');
    });

    it('handles circular references without throwing', () => {
        const data = { name: 'Jason' };
        data.self = data;
        const scopes = [makeScope('main', data)];

        expect(() => snapshot(scopes, 'main')).not.toThrow();
    });
});
