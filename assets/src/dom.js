/** @import { Scope } from './types.js' */

import { resolveRefs, buildRefMap, buildCrossScopeRefs } from './refs.js';
import { makeProxy } from './proxy.js';

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
 * @returns {void}
 */
function attachTwoWayListener(element, path, scope) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
        return;
    }

    /** @type {FormControl} */
    const formControl = element;

    formControl.addEventListener('input', () => {
        const parts = path.split('.');
        const last = parts.pop();
        const parent = parts.reduce((current, key) => current[key], scope.proxy);

        parent[last] = formControl.value;
    });
}

/**
 * Walk the full document tree, discover wire scope comment markers and
 * `<script type="wire">` bootstrap tags, collect `data-wire` bindings, then
 * resolve refs and set up reactive proxies for every found scope.
 *
 * @param {Scope[]} scopes - mutable array; discovered scopes are pushed here
 * @returns {void}
 */
export function parseScopes(scopes) {
    const walker = document.createTreeWalker(
        document,
        NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_ELEMENT
    );

    /** @type {Scope[]} */
    const stack = [];
    let node;

    while ((node = walker.nextNode())) {
        if (node.nodeType === Node.COMMENT_NODE) {
            const text = node.textContent.trim();

            if (text.startsWith('wire-scope:')) {
                stack.push({
                    name: text.slice('wire-scope:'.length),
                    data: null,
                    bindings: [],
                    refMap: {},
                    startComment: node,
                    endComment: null,
                    proxy: null,
                });
            } else if (text.startsWith('/wire-scope:') && stack.length) {
                const scope = stack.pop();
                scope.endComment = node;

                if (scope.data) {
                    scopes.push(scope);
                }
            }
        } else if (node.nodeType === Node.ELEMENT_NODE && stack.length) {
            const scope = stack[stack.length - 1];

            if (node.tagName === 'SCRIPT' && node.type === 'wire') {
                scope.data = JSON.parse(node.textContent);
            }

            if (node.hasAttribute('data-wire')) {
                const [path, target = 'text'] = node.getAttribute('data-wire').split(':');
                scope.bindings.push({ element: node, path, target });
            }
        }
    }

    for (const scope of scopes) {
        resolveRefs(scope.data, scopes);
        scope.refMap = buildRefMap(scope.data);
    }

    buildCrossScopeRefs(scopes);

    for (const scope of scopes) {
        scope.proxy = makeProxy(scope.data, scope);
        setupTwoWay(scope);
    }
}

/**
 * Attach `input` event listeners for all two-way (`value`) bindings in a scope.
 *
 * @param {Scope} scope
 * @returns {void}
 */
export function setupTwoWay(scope) {
    for (const binding of scope.bindings) {
        if (binding.target === 'value') {
            attachTwoWayListener(binding.element, binding.path, scope);
        }
    }
}

/**
 * Find the innermost scope that contains `element` by comparing document
 * positions against the scope's boundary comment nodes.
 *
 * @param {HTMLElement} element
 * @param {Scope[]} scopes
 * @returns {Scope|null}
 */
export function findScopeFor(element, scopes) {
    for (const scope of scopes) {
        const afterStart = scope.startComment.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING;
        const beforeEnd = scope.endComment.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING;

        if (afterStart && beforeEnd) {
            return scope;
        }
    }

    return null;
}

/**
 * Register a dynamically added element into the appropriate scope and wire up
 * its two-way binding if needed.
 *
 * @param {HTMLElement} element
 * @param {Scope[]} scopes
 * @returns {void}
 */
export function registerElement(element, scopes) {
    if (!element.hasAttribute('data-wire')) {
        return;
    }

    const scope = findScopeFor(element, scopes);

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
 *
 * @param {Scope[]} scopes
 * @returns {void}
 */
export function setupMutationObserver(scopes) {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.hasAttribute('data-wire')) {
                        registerElement(node, scopes);
                    }

                    node.querySelectorAll('[data-wire]').forEach(element => registerElement(element, scopes));
                }
            }
        }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
}
