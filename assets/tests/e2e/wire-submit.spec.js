import { test, expect } from '@playwright/test';

const ANCHOR = 'h1[data-wire="user.name"]';

test.beforeEach(async ({ page }) => {
    await page.goto('/wire-test/fixture');
});

test.describe('Wire.submit', () => {
    test('posts the entity to the server-resolved URL with the route method', async ({ page }) => {
        const result = await page.evaluate(async (sel) => {
            const user = window.Wire.getScope(document.querySelector(sel)).get('user');
            const response = await window.Wire.submit(user);
            return { status: response.status, body: await response.json() };
        }, ANCHOR);

        expect(result.status).toBe(200);
        expect(result.body.method).toBe('PUT');
        expect(typeof result.body.id).toBe('number');
    });

    test('strips identity tags from the request body', async ({ page }) => {
        const body = await page.evaluate(async (sel) => {
            const user = window.Wire.getScope(document.querySelector(sel)).get('user');
            const response = await window.Wire.submit(user);
            return (await response.json()).body;
        }, ANCHOR);

        expect(body.__class).toBeUndefined();
        expect(body.__id).toBeUndefined();
        expect(body.__submit).toBeUndefined();
        expect(body.name).toBe('Jason');
        expect(body.email).toBe('jason@example.com');
    });

    test('throws when value has no __submit', async ({ page }) => {
        const error = await page.evaluate(async () => {
            try {
                await window.Wire.submit({ name: 'plain' });
                return null;
            } catch (e) {
                return e.message;
            }
        });

        expect(error).toContain('no __submit');
    });

    test('options.method overrides the route-declared method', async ({ page }) => {
        const status = await page.evaluate(async (sel) => {
            const user = window.Wire.getScope(document.querySelector(sel)).get('user');
            // Route is PUT-only; forcing POST should fail with 405 Method Not Allowed.
            const response = await window.Wire.submit(user, { method: 'POST' });
            return response.status;
        }, ANCHOR);

        expect(status).toBe(405);
    });

    test('options.headers are merged with Content-Type', async ({ page }) => {
        const status = await page.evaluate(async (sel) => {
            const user = window.Wire.getScope(document.querySelector(sel)).get('user');
            const response = await window.Wire.submit(user, { headers: { 'X-Custom': 'yes' } });
            return response.status;
        }, ANCHOR);

        expect(status).toBe(200);
    });
});
