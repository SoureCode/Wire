/** @import { Binding, Scope, ScopeDraft, ScopePending } from './types.js' */

import { resolveRefs, buildRefMap, buildCrossScopeRefs } from './refs.js';
import { unifyByIdentity } from './identity.js';
import { clearRegistry, registerEntity, registerScopePresence } from './entityRegistry.js';
import { applyBinding } from './bindings.js';
import { extractPaths } from './path.js';
import { createScope, findScopeFor } from './scope.js';

/**
 * Walk the document, identify wire scope boundaries + binding markers, and
 * apply initial bindings.
 */
export function parseScopes() {
    /** @type {ScopePending[]} */
    const stack = [];
    /** @type {ScopeDraft[]} */
    const drafts = [];
    const markerStack = [];

    const walker = document.createTreeWalker(
        document,
        NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_ELEMENT
    );
    let node;
    while ((node = walker.nextNode())) {
        if (node.nodeType === Node.COMMENT_NODE) {
            consumeComment(node, stack, drafts, markerStack);
            continue;
        }

        if (stack.length === 0) continue;
        const draft = stack[stack.length - 1];

        if (node instanceof HTMLScriptElement && node.type === 'wire') {
            draft.data = JSON.parse(node.textContent);
            continue;
        }

        for (const attr of Array.from(node.attributes)) {
            if (!attr.name.startsWith('wire:')) continue;
            const attrName = attr.name.slice(5);
            const descriptor = JSON.parse(attr.value);
            draft.bindings.push({
                kind: 'attr',
                node,
                attr: attrName,
                descriptor,
                paths: extractPaths(descriptor),
            });
        }
    }

    for (const draft of drafts) {
        resolveRefs(draft.data, drafts);
    }

    clearRegistry();
    const identityMap = unifyByIdentity(drafts);
    for (const canonical of identityMap.values()) {
        registerEntity(canonical);
    }

    for (const draft of drafts) {
        draft.refMap = buildRefMap(draft.data);
    }

    buildCrossScopeRefs(drafts);

    for (const draft of drafts) {
        const scope = createScope(draft);
        registerScopePresence(scope);

        for (const binding of scope.bindings) {
            if (binding.kind === 'attr' && binding.attr === 'value' && isFormControl(binding.node) && isPurePath(binding.descriptor)) {
                attachTwoWayListener(binding.node, binding.descriptor.p, scope);
            }
            applyBinding(binding, scope.data);
        }
    }
}

/**
 * Handle a comment node during the document walk: open/close scope frames,
 * open/close binding-marker frames.
 */
function consumeComment(node, stack, drafts, markerStack) {
    const text = node.textContent;
    const trimmed = text.trim();

    if (trimmed.startsWith('wire-scope:')) {
        stack.push({
            name: trimmed.slice('wire-scope:'.length),
            startComment: node,
            endComment: null,
            data: null,
            bindings: [],
        });
        return;
    }

    if (trimmed.startsWith('/wire-scope:') && stack.length) {
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
        return;
    }

    if (text.startsWith('w:') && stack.length) {
        const descriptor = JSON.parse(text.slice(2));
        markerStack.push({ open: node, descriptor, draft: stack[stack.length - 1] });
        return;
    }

    if (text === '/w' && markerStack.length) {
        const { open, descriptor, draft } = markerStack.pop();
        const placeholder = ensurePlaceholder(open, node);
        draft.bindings.push({
            kind: 'text',
            node: placeholder,
            descriptor,
            paths: extractPaths(descriptor),
        });
    }
}

/**
 * Ensure there is exactly one Text node sitting between `open` and `close`
 * comments, returning that node. Any other siblings between the comments
 * are removed — Wire owns the content between markers.
 *
 * @param {Comment} open
 * @param {Comment} close
 * @returns {Text}
 */
function ensurePlaceholder(open, close) {
    let placeholder = null;
    let cursor = open.nextSibling;
    while (cursor && cursor !== close) {
        const next = cursor.nextSibling;
        if (placeholder === null && cursor.nodeType === Node.TEXT_NODE) {
            placeholder = cursor;
        } else {
            cursor.parentNode.removeChild(cursor);
        }
        cursor = next;
    }
    if (placeholder === null) {
        placeholder = document.createTextNode('');
        open.parentNode.insertBefore(placeholder, close);
    }
    return placeholder;
}

function isFormControl(el) {
    return el instanceof HTMLInputElement
        || el instanceof HTMLTextAreaElement
        || el instanceof HTMLSelectElement;
}

function isPurePath(descriptor) {
    return typeof descriptor.p === 'string' && (!descriptor.f || descriptor.f.length === 0);
}

/**
 * Attach an `input` listener that writes the element's value back into the
 * scope proxy at `path`.
 *
 * @param {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement} element
 * @param {string} path
 * @param {Scope} scope
 */
function attachTwoWayListener(element, path, scope) {
    element.addEventListener('input', () => {
        const parts = path.split('.');
        const last = parts.pop();
        const parent = parts.reduce((current, key) => current[key], scope.proxy);
        parent[last] = element.value;
    });
}

/**
 * Register a dynamically added subtree's bindings with their containing
 * scope. Both attribute markers (wire:*) and comment-marker pairs inside
 * the subtree are recognised.
 *
 * @param {Element} root
 */
function registerSubtree(root) {
    const scope = findScopeFor(root);
    if (!scope) return;

    // Element-level wire:* attributes anywhere in the subtree (root + descendants)
    for (const el of [root, ...root.querySelectorAll('*')]) {
        for (const attr of Array.from(el.attributes)) {
            if (!attr.name.startsWith('wire:')) continue;
            if (scope.bindings.some(b => b.kind === 'attr' && b.node === el && b.attr === attr.name.slice(5))) continue;
            const attrName = attr.name.slice(5);
            const descriptor = JSON.parse(attr.value);
            const binding = {
                kind: 'attr',
                node: el,
                attr: attrName,
                descriptor,
                paths: extractPaths(descriptor),
            };
            scope.bindings.push(binding);
            if (attrName === 'value' && isFormControl(el) && isPurePath(descriptor)) {
                attachTwoWayListener(el, descriptor.p, scope);
            }
            applyBinding(binding, scope.data);
        }
    }

    // Comment-marker pairs in the subtree
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    const opens = [];
    let node;
    while ((node = walker.nextNode())) {
        const text = node.textContent;
        if (text.startsWith('w:')) {
            opens.push({ open: node, descriptor: JSON.parse(text.slice(2)) });
        } else if (text === '/w' && opens.length) {
            const { open, descriptor } = opens.pop();
            if (scope.bindings.some(b => b.kind === 'text' && b.node && b.node.previousSibling === open)) continue;
            const placeholder = ensurePlaceholder(open, node);
            const binding = {
                kind: 'text',
                node: placeholder,
                descriptor,
                paths: extractPaths(descriptor),
            };
            scope.bindings.push(binding);
            applyBinding(binding, scope.data);
        }
    }
}

/**
 * Watch the document for dynamically added subtrees and register any
 * marker bindings they contain.
 */
export function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                registerSubtree(node);
            }
        }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
}
