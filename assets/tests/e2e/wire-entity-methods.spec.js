import { test, expect } from '@playwright/test';

const FIXTURE_URL = '/wire-test/entity-methods-fixture';
const ANCHOR      = '#user-name';

const userProxy = `(sel) => window.Wire.getScope(document.querySelector(sel)).get('user')`;

test.describe('Entity proxy $-methods', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(FIXTURE_URL);
        await expect(page.locator('#user-name')).toHaveText('Alice');
    });

    test('$getClass and $getId return the identity tags', async ({ page }) => {
        const tag = await page.evaluate((sel) => {
            const u = window.Wire.getScope(document.querySelector(sel)).get('user');
            return { cls: u.$getClass(), id: u.$getId() };
        }, ANCHOR);
        expect(typeof tag.cls).toBe('string');
        expect(tag.cls.length).toBeGreaterThan(0);
        expect(typeof tag.id).toBe('number');
    });

    test('$getSnapshot returns data without identity tags', async ({ page }) => {
        const snap = await page.evaluate((sel) => {
            return window.Wire.getScope(document.querySelector(sel)).get('user').$getSnapshot();
        }, ANCHOR);
        expect(snap).toMatchObject({ name: 'Alice', email: 'alice@example.com', status: 'active' });
        expect(snap.__class).toBeUndefined();
        expect(snap.__id).toBeUndefined();
        expect(snap.__read).toBeUndefined();
        expect(snap.__update).toBeUndefined();
    });

    test('$isDirty toggles after a local mutation and after $revert', async ({ page }) => {
        const result = await page.evaluate((sel) => {
            const u = window.Wire.getScope(document.querySelector(sel)).get('user');
            const initial = u.$isDirty();
            u.name = 'Bob';
            const afterMutation = u.$isDirty();
            u.$revert();
            const afterRevert = u.$isDirty();
            return { initial, afterMutation, afterRevert, name: u.name };
        }, ANCHOR);

        expect(result.initial).toBe(false);
        expect(result.afterMutation).toBe(true);
        expect(result.afterRevert).toBe(false);
        expect(result.name).toBe('Alice');
        await expect(page.locator('#user-name')).toHaveText('Alice');
    });

    test('$update PATCHes the server, merges response, refreshes baseline', async ({ page }) => {
        const result = await page.evaluate(async (sel) => {
            const u = window.Wire.getScope(document.querySelector(sel)).get('user');
            u.name = 'Bob';
            const response = await u.$update();
            return { name: u.name, dirty: u.$isDirty(), response };
        }, ANCHOR);

        expect(result.name).toBe('Bob');
        expect(result.dirty).toBe(false);
        expect(result.response).toMatchObject({ name: 'Bob' });
        await expect(page.locator('#user-name')).toHaveText('Bob');
    });

    test('$read fetches fresh server state and clears dirty state', async ({ page }) => {
        const result = await page.evaluate(async (sel) => {
            const u = window.Wire.getScope(document.querySelector(sel)).get('user');
            u.email = 'changed@local.test';
            let threw = false;
            try { await u.$read(); } catch (e) { threw = true; }
            await u.$read({ force: true });
            return { threw, email: u.email, dirty: u.$isDirty() };
        }, ANCHOR);

        expect(result.threw).toBe(true);
        expect(result.email).toBe('alice@example.com');
        expect(result.dirty).toBe(false);
    });

    test('$on(callback) fires for every field change', async ({ page }) => {
        const events = await page.evaluate((sel) => {
            const u = window.Wire.getScope(document.querySelector(sel)).get('user');
            const seen = [];
            u.$on((next, prev, p) => seen.push({ next, prev, p }));
            u.name = 'Carol';
            u.email = 'carol@x';
            return seen;
        }, ANCHOR);

        expect(events).toEqual([
            { next: 'Carol',     prev: 'Alice',                p: 'name'  },
            { next: 'carol@x',   prev: 'alice@example.com',    p: 'email' },
        ]);
    });

    test('$on(path, callback) fires only for the matching path', async ({ page }) => {
        const events = await page.evaluate((sel) => {
            const u = window.Wire.getScope(document.querySelector(sel)).get('user');
            const seen = [];
            u.$on('email', (next, prev, p) => seen.push(p));
            u.name = 'Dan';
            u.email = 'dan@x';
            return seen;
        }, ANCHOR);

        expect(events).toEqual(['email']);
    });

    test('$getHistory records $update and $read', async ({ page }) => {
        const ops = await page.evaluate(async (sel) => {
            const u = window.Wire.getScope(document.querySelector(sel)).get('user');
            u.name = 'Eve';
            await u.$update();
            await u.$read();
            return u.$getHistory().map(h => h.op);
        }, ANCHOR);

        expect(ops).toEqual(['update', 'read']);
    });
});
