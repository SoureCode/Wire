/** @import { Scope, ScopeHandle, ScopeInit } from './types.js' */

import { stripIdentityTags } from './identity.js';
import { makeProxy } from './proxy.js';
import { deepClone } from './utils/deepClone.js';

/**
 * Module-private registry of every fully-built scope on the current page.
 * Mutated only via createScope(); read only via findScopeFor().
 *
 * @type {Scope[]}
 */
const scopes = [];

/**
 * Build the public scope handle exposed by Wire.getScope() and the proxy's
 * `getScope()` method. Carries no internal binding/refMap state.
 *
 * @param {Scope} scope
 * @returns {ScopeHandle}
 */
function createScopeHandle(scope) {
    return {
        get(name) {
            return scope.proxy[name];
        },
        getSnapshot(name) {
            const source = name === undefined ? scope.data : scope.data?.[name];
            return stripIdentityTags(deepClone(source));
        },
    };
}

/**
 * Finalize a parsed scope: build its reactive proxy and public handle, push
 * it into the page-wide registry, and return the fully-typed `Scope`.
 *
 * @param {ScopeInit} init
 * @returns {Scope}
 */
export function createScope(init) {
    const scope = new Scope(init);
    scopes.push(scope);
    return scope;
}

/**
 * Class form lets the constructor wire up proxy and handle in order
 * without nullable placeholder fields or casts.
 */
export class Scope {
    /** @param {ScopeInit} init */
    constructor(init) {
        this.name = init.name;
        this.startComment = init.startComment;
        this.endComment = init.endComment;
        this.data = init.data;
        this.bindings = init.bindings;
        this.refMap = init.refMap;
        this.proxy = makeProxy(this.data, this);
        this.handle = createScopeHandle(this);
    }
}

/**
 * Find the scope that contains `element` by comparing document positions
 * against the scope's boundary comment nodes.
 *
 * @param {Element} element
 * @returns {Scope|null}
 */
export function findScopeFor(element) {
    for (const scope of scopes) {
        const afterStart = scope.startComment.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING;
        const beforeEnd = scope.endComment.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING;

        if (afterStart && beforeEnd) {
            return scope;
        }
    }

    return null;
}
