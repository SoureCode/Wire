/** @import { ScopeBindings } from '../../src/types.js' */

import { describe, it, expect } from 'vitest';
import { makeProxy } from '../../src/proxy.js';

/**
 * @param {Record<string, unknown>} data
 * @returns {ScopeBindings}
 */
function makeScope(data) {
    return { data, bindings: [], refMap: {} };
}

describe('makeProxy', () => {
    it('reads a top-level primitive through the proxy', () => {
        const data = { name: 'Jason' };
        const proxy = makeProxy(data, makeScope(data));

        expect(proxy.name).toBe('Jason');
    });

    it('returns a nested proxy for object values', () => {
        const data = { user: { name: 'Jason' } };
        const proxy = makeProxy(data, makeScope(data));

        expect(typeof proxy.user).toBe('object');
        expect(proxy.user.name).toBe('Jason');
    });

    it('setting a property updates the underlying data', () => {
        const data = { name: 'Jason' };
        const proxy = makeProxy(data, makeScope(data));

        proxy.name = 'Other';

        expect(data.name).toBe('Other');
    });

    it('setting a nested property updates the underlying data', () => {
        const data = { user: { name: 'Jason' } };
        const proxy = makeProxy(data, makeScope(data));

        proxy.user.name = 'Other';

        expect(data.user.name).toBe('Other');
    });

    it('triggers DOM updates when a property is set', () => {
        const node = document.createTextNode('');
        const data = { name: 'Jason' };
        /** @type {ScopeBindings} */
        const scope = {
            data,
            bindings: [{
                kind: 'text',
                node,
                descriptor: { p: 'name' },
                paths: ['name'],
            }],
            refMap: {},
        };
        const proxy = makeProxy(data, scope);

        proxy.name = 'Updated';

        expect(node.nodeValue).toBe('Updated');
    });
});
