/** @import { Binding, ScopeBindings } from './types.js' */

import { resolvePath } from './path.js';
import { applyFilters } from './filters.js';

const BOOLEAN_ATTRS = new Set([
    'hidden', 'disabled', 'readonly', 'required', 'checked',
    'selected', 'multiple', 'autofocus', 'autoplay', 'controls',
    'loop', 'muted', 'open', 'reversed',
]);

/**
 * Evaluate a marker binding descriptor against the live scope data.
 *
 * @param {object} descriptor
 * @param {unknown} data
 * @returns {unknown}
 */
export function evaluateBinding(descriptor, data) {
    if (descriptor.parts) {
        return descriptor.parts.map(part => {
            if ('l' in part) return part.l;
            return applyFilters(resolvePath(data, part.p), part.f) ?? '';
        }).join('');
    }
    return applyFilters(resolvePath(data, descriptor.p), descriptor.f);
}

/**
 * Read the `raw` flag from a descriptor's filter chain.
 *
 * @param {object} descriptor
 * @returns {boolean}
 */
function isRaw(descriptor) {
    return Array.isArray(descriptor.f) && descriptor.f.some(([n]) => n === 'raw');
}

/**
 * Compute the binding's value and apply it to the DOM target.
 *
 * @param {Binding} binding
 * @param {Record<string, unknown>} data
 * @returns {void}
 */
export function applyBinding(binding, data) {
    const value = evaluateBinding(binding.descriptor, data);

    if (binding.kind === 'text') {
        if (isRaw(binding.descriptor)) {
            // Raw bindings write through innerHTML on the placeholder's
            // parent. Other siblings between the marker pair are wiped
            // intentionally — Wire owns the content between markers.
            const parent = binding.node.parentNode;
            if (!parent) return;
            binding.node.nodeValue = '';
            // Replace the placeholder text node's content via innerHTML on
            // a wrapper-like approach: write into the placeholder by way
            // of a temporary fragment.
            const fragment = document.createRange().createContextualFragment(String(value ?? ''));
            parent.insertBefore(fragment, binding.node);
            // Remove the now-empty placeholder; on next update we rebind to
            // a fresh text node, but for now just leave it.
            return;
        }
        binding.node.nodeValue = value == null ? '' : String(value);
        return;
    }

    // kind === 'attr'
    applyAttribute(binding.node, binding.attr, value);
}

/**
 * Apply a value to a single attribute target on an element.
 *
 * @param {Element} element
 * @param {string} attr
 * @param {unknown} value
 */
function applyAttribute(element, attr, value) {
    if (attr === 'value' && (
        element instanceof HTMLInputElement
        || element instanceof HTMLTextAreaElement
        || element instanceof HTMLSelectElement
    )) {
        element.value = value == null ? '' : String(value);
        return;
    }

    if (attr === 'innerHTML') {
        element.innerHTML = value == null ? '' : String(value);
        return;
    }

    if (BOOLEAN_ATTRS.has(attr)) {
        if (value) element.setAttribute(attr, '');
        else element.removeAttribute(attr);
        return;
    }

    element.setAttribute(attr, value == null ? '' : String(value));
}

/**
 * Re-apply every binding in `scope` whose descriptor reads from a path
 * affected by `changedPath` (exact match or prefix-of).
 *
 * @param {ScopeBindings} scope
 * @param {string} changedPath
 */
export function updateScopeBindings(scope, changedPath) {
    for (const binding of scope.bindings) {
        if (binding.paths.some(p => p === changedPath || p.startsWith(changedPath + '.') || changedPath.startsWith(p + '.'))) {
            applyBinding(binding, scope.data);
        }
    }
}

/**
 * Update bindings in the changed scope and propagate to aliased paths in
 * other scopes via the scope's refMap.
 *
 * @param {ScopeBindings} scope
 * @param {string} changedPath
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
