import { test, expect } from '@playwright/test';

/**
 * Production mode tests — APP_DEBUG=0 server on port 8124 (tests/harness/prod).
 * Scope IDs must be 8-character sha256 hex prefixes, not template paths.
 */

test.use({ baseURL: 'http://localhost:8124' });

const ANCHOR = '#name-heading';

test.beforeEach(async ({ page }) => {
    await page.goto('/wire-test/full-fixture');
});

async function readScopeName(page) {
    return page.evaluate(() => {
        const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
        let node;
        while ((node = walker.nextNode())) {
            const text = node.textContent.trim();
            if (text.startsWith('wire-scope:')) return text.slice('wire-scope:'.length);
        }
        return null;
    });
}

test.describe('scope ID format', () => {
    test('scope comment is present in the DOM', async ({ page }) => {
        expect(await readScopeName(page)).toBeTruthy();
    });

    test('scope ID is 8 characters long', async ({ page }) => {
        expect(await readScopeName(page)).toHaveLength(8);
    });

    test('scope ID is lowercase hexadecimal', async ({ page }) => {
        expect(await readScopeName(page)).toMatch(/^[0-9a-f]{8}$/);
    });

    test('scope ID is NOT the template path', async ({ page }) => {
        const name = await readScopeName(page);
        expect(name).not.toBe('wire_test/full.html.twig');
        expect(name).not.toContain('/');
        expect(name).not.toContain('.');
    });

    test('closing scope comment matches opening scope comment', async ({ page }) => {
        const { open, close } = await page.evaluate(() => {
            const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
            let node, open = null, close = null;
            while ((node = walker.nextNode())) {
                const text = node.textContent.trim();
                if (text.startsWith('wire-scope:')) open = text.slice('wire-scope:'.length);
                else if (text.startsWith('/wire-scope:')) close = text.slice('/wire-scope:'.length);
            }
            return { open, close };
        });
        expect(open).toBeTruthy();
        expect(close).toBe(open);
    });
});

test.describe('Wire API in production mode', () => {
    test('Wire.getScope works the same way in prod', async ({ page }) => {
        const type = await page.evaluate((sel) => typeof window.Wire.getScope(document.querySelector(sel)), ANCHOR);
        expect(type).toBe('object');
    });

    test('scope.get returns the variable proxy', async ({ page }) => {
        const name = await page.evaluate((sel) => window.Wire.getScope(document.querySelector(sel)).get('user').name, ANCHOR);
        expect(name).toBe('Jason');
    });

    test('scope.snapshot returns data with identity tags stripped', async ({ page }) => {
        const snap = await page.evaluate((sel) => window.Wire.getScope(document.querySelector(sel)).snapshot(), ANCHOR);
        expect(snap.user.name).toBe('Jason');
        expect(snap.user.email).toBe('jason@example.com');
        expect(snap.user.__class).toBeUndefined();
        expect(snap.user.__id).toBeUndefined();
    });

    test('entity payload carries hashed __class in prod', async ({ page }) => {
        const cls = await page.evaluate((sel) => window.Wire.getScope(document.querySelector(sel)).get('user').__class, ANCHOR);
        expect(cls).toMatch(/^[0-9a-f]{8}$/);
        expect(cls).not.toContain('App\\Entity');
    });
});

test.describe('reactivity in production mode', () => {
    test('initial text binding renders name', async ({ page }) => {
        await expect(page.locator('#name-heading')).toHaveText('Jason');
    });

    test('initial value binding sets input value', async ({ page }) => {
        await expect(page.locator('#name-input')).toHaveValue('Jason');
    });

    test('initial attribute binding sets class', async ({ page }) => {
        await expect(page.locator('#status-class')).toHaveAttribute('class', 'active');
    });

    test('programmatic mutation updates DOM', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'ProdBob'; }, ANCHOR);
        await expect(page.locator('#name-heading')).toHaveText('ProdBob');
        await expect(page.locator('#name-input')).toHaveValue('ProdBob');
    });

    test('two-way binding works in production mode', async ({ page }) => {
        await page.locator('#name-input').fill('ProdTyped');
        await expect(page.locator('#name-heading')).toHaveText('ProdTyped');
    });

    test('snapshot reflects programmatic changes in production mode', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'ProdSnap'; }, ANCHOR);
        const snap = await page.evaluate((sel) => window.Wire.getScope(document.querySelector(sel)).snapshot(), ANCHOR);
        expect(snap.user.name).toBe('ProdSnap');
    });
});
