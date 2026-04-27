/** @import { ScopeBindings } from '../../src/types.js' */

import { describe, it, expect, beforeEach } from 'vitest';
import { makeProxy } from '../../src/proxy.js';
import { clearRegistry, registerEntity } from '../../src/entityRegistry.js';

/**
 * @param {Record<string, unknown>} data
 * @returns {ScopeBindings}
 */
function makeScope(data) {
    return { data, bindings: [], refMap: {} };
}

describe('makeProxy', () => {
    beforeEach(() => clearRegistry());

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

    it('$getType returns the opaque identity type', () => {
        const data = { __wire: { type: 'user-token', id: 42 }, name: 'Alice' };
        const proxy = makeProxy(data, makeScope(data));

        expect(proxy.$getType()).toBe('user-token');
    });

    it('$getType returns undefined for non-entity proxies', () => {
        const data = { name: 'Alice' };
        const proxy = makeProxy(data, makeScope(data));

        expect(proxy.$getType()).toBeUndefined();
    });

    it('$getId returns the wire identity id', () => {
        const data = { __wire: { type: 'user-token', id: 42 }, name: 'Alice' };
        const proxy = makeProxy(data, makeScope(data));

        expect(proxy.$getId()).toBe(42);
    });

    it('$getId returns undefined for non-entity proxies', () => {
        const data = { name: 'Alice' };
        const proxy = makeProxy(data, makeScope(data));

        expect(proxy.$getId()).toBeUndefined();
    });

    it('$getSnapshot returns a clone without identity tags', () => {
        const data = { __wire: { type: 'X', id: 1 }, name: 'Alice', nested: { __wire: { type: 'Y', id: 2 }, k: 'v' } };
        const proxy = makeProxy(data, makeScope(data));

        const snap = proxy.$getSnapshot();
        expect(snap).toEqual({ name: 'Alice', nested: { k: 'v' } });
        expect(snap).not.toBe(data);
    });

    it('$isDirty returns false for non-entity proxies', () => {
        const data = { name: 'Alice' };
        const proxy = makeProxy(data, makeScope(data));
        expect(proxy.$isDirty()).toBe(false);
    });

    it('$isDirty returns false when state matches the registered baseline', () => {
        const data = { __wire: { type: 'User', id: 1 }, name: 'Alice' };
        registerEntity(data);
        const proxy = makeProxy(data, makeScope(data));
        expect(proxy.$isDirty()).toBe(false);
    });

    it('$isDirty returns true after a field mutation', () => {
        const data = { __wire: { type: 'User', id: 1 }, name: 'Alice' };
        registerEntity(data);
        const proxy = makeProxy(data, makeScope(data));
        proxy.name = 'Bob';
        expect(proxy.$isDirty()).toBe(true);
    });

    it('$revert restores baseline values and triggers DOM updates', () => {
        const node = document.createTextNode('');
        const data = { __wire: { type: 'User', id: 1 }, name: 'Alice' };
        registerEntity(data);
        const scope = {
            data,
            bindings: [{ kind: 'text', node, descriptor: { p: 'name' }, paths: ['name'] }],
            refMap: {},
        };
        const proxy = makeProxy(data, scope);
        proxy.name = 'Bob';
        expect(node.nodeValue).toBe('Bob');

        proxy.$revert();

        expect(data.name).toBe('Alice');
        expect(node.nodeValue).toBe('Alice');
        expect(proxy.$isDirty()).toBe(false);
    });

    it('$revert removes fields added since the baseline', () => {
        const data = { __wire: { type: 'User', id: 1 }, name: 'Alice' };
        registerEntity(data);
        const proxy = makeProxy(data, makeScope(data));
        proxy.email = 'a@x';
        expect(proxy.$isDirty()).toBe(true);

        proxy.$revert();

        expect('email' in data).toBe(false);
        expect(proxy.$isDirty()).toBe(false);
    });

    it('$on(callback) fires for any field change on the entity', () => {
        const data = { __wire: { type: 'User', id: 1 }, name: 'Alice', email: 'a@x' };
        registerEntity(data);
        const proxy = makeProxy(data, makeScope(data));

        const events = [];
        const off = proxy.$on((next, prev, p) => events.push({ next, prev, p }));

        proxy.name = 'Bob';
        proxy.email = 'b@x';
        off();
        proxy.name = 'Carol';

        expect(events).toEqual([
            { next: 'Bob', prev: 'Alice', p: 'name' },
            { next: 'b@x', prev: 'a@x',   p: 'email' },
        ]);
    });

    it('$on(path, callback) fires only for that path or sub-paths', () => {
        const data = { __wire: { type: 'User', id: 1 }, address: { street: 'Main', zip: '1' }, name: 'Alice' };
        registerEntity(data);
        const proxy = makeProxy(data, makeScope(data));

        const events = [];
        proxy.$on('address', (next, prev, p) => events.push(p));

        proxy.name = 'Bob';
        proxy.address.street = 'Oak';
        proxy.address.zip = '2';

        expect(events).toEqual(['address.street', 'address.zip']);
    });

    it('$on returns a no-op unsubscribe for non-entity proxies', () => {
        const data = { name: 'Alice' };
        const proxy = makeProxy(data, makeScope(data));
        const off  = proxy.$on(() => {});
        expect(typeof off).toBe('function');
        off();
    });

    it('$on throws on bad arguments', () => {
        const data = { __wire: { type: 'U', id: 1 } };
        registerEntity(data);
        const proxy = makeProxy(data, makeScope(data));
        expect(() => proxy.$on()).toThrow(TypeError);
        expect(() => proxy.$on(123)).toThrow(TypeError);
    });

    it('$update throws when the entity has no __wire identity', async () => {
        const data = { name: 'Alice' };
        const proxy = makeProxy(data, makeScope(data));
        await expect(proxy.$update()).rejects.toThrow(/no __wire identity/);
    });

    it('$update throws when __update endpoint is missing', async () => {
        const data = { __wire: { type: 'User', id: 1 }, name: 'Alice' };
        registerEntity(data);
        const proxy = makeProxy(data, makeScope(data));
        await expect(proxy.$update()).rejects.toThrow(/no __update/);
    });

    it('$update POSTs the snapshot, merges the response, and refreshes baseline', async () => {
        const data = {
            __wire: { type: 'User', id: 1 },
            __update: { url: '/api/users/1', method: 'PATCH' },
            name: 'Alice',
        };
        registerEntity(data);
        const proxy = makeProxy(data, makeScope(data));

        const calls = [];
        globalThis.fetch = (url, init) => {
            calls.push({ url, init });
            return Promise.resolve({
                ok: true,
                status: 200,
                text: () => Promise.resolve(JSON.stringify({
                    __wire: { type: 'User', id: 1 },
                    name: 'Alice',
                    status: 'saved',
                })),
            });
        };

        proxy.name = 'Bob';
        const result = await proxy.$update();

        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe('/api/users/1');
        expect(calls[0].init.method).toBe('PATCH');
        expect(JSON.parse(calls[0].init.body)).toEqual({ name: 'Bob' });
        expect(data.status).toBe('saved');
        expect(data.name).toBe('Alice');
        expect(proxy.$isDirty()).toBe(false);
        expect(result.status).toBe('saved');
    });

    it('$update rejects on 4xx with status and response on the error', async () => {
        const data = {
            __wire: { type: 'User', id: 1 },
            __update: { url: '/api/users/1', method: 'PATCH' },
            name: 'Alice',
        };
        registerEntity(data);
        const proxy = makeProxy(data, makeScope(data));

        globalThis.fetch = () => Promise.resolve({
            ok: false,
            status: 422,
            text: () => Promise.resolve(''),
        });

        proxy.name = 'Bob';
        await expect(proxy.$update()).rejects.toMatchObject({ status: 422 });
        expect(data.name).toBe('Bob');
    });

    it('$read merges fresh server state and clears dirty flag', async () => {
        const data = {
            __wire: { type: 'User', id: 1 },
            __read: { url: '/api/users/1', method: 'GET' },
            name: 'Alice',
        };
        registerEntity(data);
        const proxy = makeProxy(data, makeScope(data));

        globalThis.fetch = () => Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(JSON.stringify({
                __wire: { type: 'User', id: 1 },
                name: 'Server',
                email: 's@x',
            })),
        });

        await proxy.$read();

        expect(data.name).toBe('Server');
        expect(data.email).toBe('s@x');
        expect(proxy.$isDirty()).toBe(false);
    });

    it('$read throws on unsaved local edits unless { force: true }', async () => {
        const data = {
            __wire: { type: 'User', id: 1 },
            __read: { url: '/api/users/1', method: 'GET' },
            name: 'Alice',
        };
        registerEntity(data);
        const proxy = makeProxy(data, makeScope(data));

        proxy.name = 'Bob';

        await expect(proxy.$read()).rejects.toThrow(/unsaved local edits/);

        globalThis.fetch = () => Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(JSON.stringify({
                __wire: { type: 'User', id: 1 },
                name: 'Server',
            })),
        });
        await proxy.$read({ force: true });
        expect(data.name).toBe('Server');
    });

    it('$getHistory records read and update operations only', async () => {
        const data = {
            __wire: { type: 'User', id: 1 },
            __read:   { url: '/api/users/1', method: 'GET' },
            __update: { url: '/api/users/1', method: 'PATCH' },
            name: 'Alice',
        };
        registerEntity(data);
        const proxy = makeProxy(data, makeScope(data));

        proxy.name = 'Bob';
        expect(proxy.$getHistory()).toEqual([]);

        globalThis.fetch = () => Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve(JSON.stringify({
                __wire: { type: 'User', id: 1 },
                name: 'Bob',
            })),
        });

        await proxy.$update();
        await proxy.$read();

        const history = proxy.$getHistory();
        expect(history).toHaveLength(2);
        expect(history[0].op).toBe('update');
        expect(history[0].snapshot).toMatchObject({ name: 'Bob' });
        expect(history[1].op).toBe('read');
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
