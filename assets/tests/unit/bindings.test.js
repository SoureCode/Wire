/** @import { ScopeBindings } from '../../src/types.js' */

import { describe, it, expect } from 'vitest';
import { applyBinding, evaluateBinding, updateScopeBindings, updateBindings } from '../../src/bindings.js';

function textBinding(node, descriptor) {
    return { kind: 'text', node, descriptor, paths: descriptor.p ? [descriptor.p] : descriptor.parts.flatMap(p => 'p' in p ? [p.p] : []) };
}

function attrBinding(element, attr, descriptor) {
    return { kind: 'attr', node: element, attr, descriptor, paths: descriptor.p ? [descriptor.p] : descriptor.parts.flatMap(p => 'p' in p ? [p.p] : []) };
}

describe('evaluateBinding', () => {
    it('resolves a pure path', () => {
        expect(evaluateBinding({ p: 'user.name' }, { user: { name: 'Jason' } })).toBe('Jason');
    });

    it('applies a filter chain', () => {
        expect(evaluateBinding({ p: 'name', f: [['upper']] }, { name: 'jas' })).toBe('JAS');
    });

    it('rebuilds concat parts', () => {
        expect(evaluateBinding(
            { parts: [{ l: 'pre-' }, { p: 'a' }, { l: '-suf' }] },
            { a: 'X' },
        )).toBe('pre-X-suf');
    });
});

describe('applyBinding', () => {
    it('writes nodeValue for text bindings', () => {
        const node = document.createTextNode('');
        applyBinding(textBinding(node, { p: 'name' }), { name: 'Hello' });
        expect(node.nodeValue).toBe('Hello');
    });

    it('writes value on form controls for attr=value', () => {
        const input = document.createElement('input');
        applyBinding(attrBinding(input, 'value', { p: 'name' }), { name: 'typed' });
        expect(input.value).toBe('typed');
    });

    it('sets a regular attribute via setAttribute', () => {
        const el = document.createElement('span');
        applyBinding(attrBinding(el, 'class', { p: 'status' }), { status: 'active' });
        expect(el.getAttribute('class')).toBe('active');
    });

    it('applies a filter chain in attr context', () => {
        const el = document.createElement('span');
        applyBinding(attrBinding(el, 'data-name', { p: 'name', f: [['upper']] }), { name: 'jas' });
        expect(el.getAttribute('data-name')).toBe('JAS');
    });

    it('uses empty string when value is null', () => {
        const node = document.createTextNode('original');
        applyBinding(textBinding(node, { p: 'missing' }), {});
        expect(node.nodeValue).toBe('');
    });
});

describe('updateScopeBindings', () => {
    it('updates bindings whose path matches changedPath', () => {
        const node = document.createTextNode('');
        /** @type {ScopeBindings} */
        const scope = {
            data: { user: { name: 'Jason' } },
            bindings: [textBinding(node, { p: 'user.name' })],
            refMap: {},
        };

        updateScopeBindings(scope, 'user.name');

        expect(node.nodeValue).toBe('Jason');
    });

    it('updates bindings when a parent path changes', () => {
        const node = document.createTextNode('');
        /** @type {ScopeBindings} */
        const scope = {
            data: { user: { name: 'Jason' } },
            bindings: [textBinding(node, { p: 'user.name' })],
            refMap: {},
        };

        updateScopeBindings(scope, 'user');

        expect(node.nodeValue).toBe('Jason');
    });

    it('does not update bindings for unrelated paths', () => {
        const node = document.createTextNode('original');
        /** @type {ScopeBindings} */
        const scope = {
            data: { user: { name: 'Jason' } },
            bindings: [textBinding(node, { p: 'user.name' })],
            refMap: {},
        };

        updateScopeBindings(scope, 'other');

        expect(node.nodeValue).toBe('original');
    });
});

describe('updateBindings', () => {
    it('propagates update to aliased scope via refMap', () => {
        const node1 = document.createTextNode('');
        const node2 = document.createTextNode('');

        /** @type {ScopeBindings} */
        const scope1 = {
            data: { address: { city: 'Berlin' } },
            bindings: [textBinding(node1, { p: 'address.city' })],
            refMap: {},
        };

        /** @type {ScopeBindings} */
        const scope2 = {
            data: { location: { city: 'Berlin' } },
            bindings: [textBinding(node2, { p: 'location.city' })],
            refMap: {},
        };

        scope1.refMap['address'] = [{ scope: scope2, path: 'location' }];

        scope1.data.address.city = 'Munich';
        updateBindings(scope1, 'address.city');

        expect(node1.nodeValue).toBe('Munich');
        // scope2 has its own independent data here; refMap propagation
        // re-applies the binding but reads scope2.data which is unchanged.
        expect(node2.nodeValue).toBe('Berlin');
    });
});
