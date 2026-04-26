/** @import { ScopePending, ScopeDraft } from './types.js' */

import { resolveRefs, buildRefMap, buildCrossScopeRefs } from './refs.js';
import { unifyByIdentity } from './identity.js';
import { applyBinding } from './bindings.js';
import { resolvePath } from './path.js';
import { Scope } from './scope.js';
import { createScope, findScopeFor } from './scope.js';

/**
 * @typedef {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement} FormControl
 */

/**
 * Attach an `input` listener that writes the element's value back into the
 * scope proxy at `path`. No-op when `element` is not a form control.
 *
 * @param {HTMLElement} element
 * @param {string} path
 * @param {Scope} scope
 */
function attachTwoWayListener(element, path, scope) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
        return;
    }

    element.addEventListener('input', () => {
        const parts = path.split('.');
        const last = parts.pop();
        const parent = parts.reduce((current, key) => current[key], scope.proxy);

        parent[last] = element.value;
    });
}

/**
 * Walk the document, finalize every wire scope found via createScope(), and
 * apply initial bindings.
 */
export function parseScopes() {
    /** @type {ScopePending[]} */
    const stack = [];
    /** @type {ScopeDraft[]} */
    const drafts = [];

    const walker = document.createTreeWalker(
        document,
        NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_ELEMENT
    );
    let node;

    while ((node = walker.nextNode())) {
        if (node instanceof Comment) {
            const text = node.textContent.trim();

            if (text.startsWith('wire-scope:')) {
                stack.push({
                    name: text.slice('wire-scope:'.length),
                    startComment: node,
                    endComment: null,
                    data: null,
                    bindings: [],
                });
            } else if (text.startsWith('/wire-scope:') && stack.length) {
                const pending = stack.pop();

                if (pending.data) {
                    drafts.push({
                        name: pending.name,
                        startComment: pending.startComment,
                        endComment: node,
                        data: pending.data,
                        bindings: pending.bindings,
                        refMap: {},
                    });
                }
            }
        } else if (node instanceof HTMLElement && stack.length) {
            const pending = stack[stack.length - 1];

            if (node instanceof HTMLScriptElement && node.type === 'wire') {
                pending.data = JSON.parse(node.textContent);
            }

            if (node.hasAttribute('data-wire')) {
                const [path, target = 'text'] = node.getAttribute('data-wire').split(':');
                pending.bindings.push({ element: node, path, target });
            }
        }
    }

    for (const draft of drafts) {
        resolveRefs(draft.data, drafts);
    }

    unifyByIdentity(drafts);

    for (const draft of drafts) {
        draft.refMap = buildRefMap(draft.data);
    }

    buildCrossScopeRefs(drafts);

    for (const draft of drafts) {
        const scope = createScope(draft);

        for (const binding of scope.bindings) {
            if (binding.target === 'value') {
                attachTwoWayListener(binding.element, binding.path, scope);
            }
            applyBinding(binding.element, binding.target, resolvePath(scope.data, binding.path));
        }
    }
}

/**
 * Register a dynamically added element into the appropriate scope and wire
 * up its two-way binding if needed.
 *
 * @param {HTMLElement} element
 */
function registerElement(element) {
    if (!element.hasAttribute('data-wire')) {
        return;
    }

    const scope = findScopeFor(element);

    if (!scope) {
        return;
    }

    if (scope.bindings.some(binding => binding.element === element)) {
        return;
    }

    const [path, target = 'text'] = element.getAttribute('data-wire').split(':');

    scope.bindings.push({ element, path, target });

    if (target === 'value') {
        attachTwoWayListener(element, path, scope);
    }
}

/**
 * Observe the document for dynamically added elements and register any that
 * carry `data-wire` attributes.
 */
export function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.hasAttribute('data-wire')) {
                        registerElement(node);
                    }

                    node.querySelectorAll('[data-wire]').forEach(element => registerElement(element));
                }
            }
        }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
}
