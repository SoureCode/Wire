/** @import { ScopeBindings } from './types.js' */

import { resolvePath } from './path.js';

const BOOLEAN_ATTRS = new Set([
    'hidden', 'disabled', 'readonly', 'required', 'checked',
    'selected', 'multiple', 'autofocus', 'autoplay', 'controls',
    'loop', 'muted', 'open', 'reversed',
]);

/**
 * Apply a resolved value to a DOM element according to the binding target.
 *
 * @param {HTMLElement} element
 * @param {string} target - "text", "value", "innerHTML", a boolean attr name, or any HTML attribute
 * @param {unknown} value
 * @returns {void}
 */
export function applyBinding(element, target, value) {
    if (target === 'text') {
        element.textContent = value ?? '';
    } else if (target === 'value') {
        element.value = value ?? '';
    } else if (target === 'innerHTML') {
        element.innerHTML = value ?? '';
    } else if (BOOLEAN_ATTRS.has(target)) {
        if (value) {
            element.setAttribute(target, '');
        } else {
            element.removeAttribute(target);
        }
    } else {
        element.setAttribute(target, value ?? '');
    }
}

/**
 * Re-apply all bindings in `scope` whose path starts with `changedPath`.
 *
 * @param {ScopeBindings} scope
 * @param {string} changedPath
 * @returns {void}
 */
export function updateScopeBindings(scope, changedPath) {
    for (const binding of scope.bindings) {
        if (binding.path === changedPath || binding.path.startsWith(changedPath + '.')) {
            applyBinding(binding.element, binding.target, resolvePath(scope.data, binding.path));
        }
    }
}

/**
 * Update bindings in the changed scope and propagate to aliased paths in other
 * scopes via the scope's refMap.
 *
 * @param {ScopeBindings} scope
 * @param {string} changedPath
 * @returns {void}
 */
export function updateBindings(scope, changedPath) {
    updateScopeBindings(scope, changedPath);

    for (const [refPath, aliases] of Object.entries(scope.refMap)) {
        if (changedPath === refPath || changedPath.startsWith(refPath + '.')) {
            const suffix = changedPath.slice(refPath.length);

            for (const alias of aliases) {
                const aliasedPath = alias.path + suffix;
                const targetScope = alias.scope || scope;

                updateScopeBindings(targetScope, aliasedPath);
            }
        }
    }
}
