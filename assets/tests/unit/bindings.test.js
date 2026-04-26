/** @import { ScopeBindings } from '../../src/types.js' */

import { describe, it, expect } from 'vitest';
import { applyBinding, updateScopeBindings, updateBindings } from '../../src/bindings.js';

function makeElement(tag = 'span') {
    return document.createElement(tag);
}

describe('applyBinding', () => {
    it('sets textContent for target "text"', () => {
        const element = makeElement();

        applyBinding(element, 'text', 'Hello');

        expect(element.textContent).toBe('Hello');
    });

    it('sets value for target "value"', () => {
        const element = makeElement('input');

        applyBinding(element, 'value', 'typed');

        expect(element.value).toBe('typed');
    });

    it('sets an attribute for any other target', () => {
        const element = makeElement();

        applyBinding(element, 'class', 'active');

        expect(element.getAttribute('class')).toBe('active');
    });

    it('uses empty string when value is null', () => {
        const element = makeElement();

        applyBinding(element, 'text', null);

        expect(element.textContent).toBe('');
    });
});

describe('updateScopeBindings', () => {
    it('updates bindings whose path matches changedPath', () => {
        const element = makeElement();
        const scope = {
            data: { user: { name: 'Jason' } },
            bindings: [{ element, path: 'user.name', target: 'text' }],
        };

        updateScopeBindings(scope, 'user.name');

        expect(element.textContent).toBe('Jason');
    });

    it('updates bindings whose path starts with changedPath', () => {
        const element = makeElement();
        const scope = {
            data: { user: { name: 'Jason' } },
            bindings: [{ element, path: 'user.name', target: 'text' }],
        };

        updateScopeBindings(scope, 'user');

        expect(element.textContent).toBe('Jason');
    });

    it('does not update bindings for unrelated paths', () => {
        const element = makeElement();
        element.textContent = 'original';
        const scope = {
            data: { user: { name: 'Jason' } },
            bindings: [{ element, path: 'user.name', target: 'text' }],
        };

        updateScopeBindings(scope, 'other');

        expect(element.textContent).toBe('original');
    });
});

describe('updateBindings', () => {
    it('propagates update to aliased scope via refMap', () => {
        const element1 = makeElement();
        const element2 = makeElement();

        /** @type {ScopeBindings} */
        const scope1 = {
            data: { address: { city: 'Berlin' } },
            bindings: [{ element: element1, path: 'address.city', target: 'text' }],
            refMap: {},
        };

        /** @type {ScopeBindings} */
        const scope2 = {
            data: { location: { city: 'Berlin' } },
            bindings: [{ element: element2, path: 'location.city', target: 'text' }],
            refMap: {},
        };

        scope1.refMap['address'] = [{ scope: scope2, path: 'location' }];

        scope1.data.address.city = 'Munich';
        updateBindings(scope1, 'address.city');

        expect(element1.textContent).toBe('Munich');
        expect(element2.textContent).toBe('Berlin');
    });
});
