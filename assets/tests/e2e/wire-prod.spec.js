import { test, expect } from '@playwright/test';

/**
 * Production mode tests — APP_DEBUG=0 server on port 8124 (tests/harness-prod).
 * Scope IDs must be 8-character sha256 hex prefixes, not template paths.
 */

test.use({ baseURL: 'http://localhost:8124' });

test.beforeEach(async ({ page }) => {
    await page.goto('/wire-test/full-fixture');
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read the first wire-scope name from DOM comments. */
async function readScopeName(page) {
    return page.evaluate(() => {
        const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
        let node;

        while ((node = walker.nextNode())) {
            const text = node.textContent.trim();

            if (text.startsWith('wire-scope:')) {
                return text.slice('wire-scope:'.length);
            }
        }

        return null;
    });
}

// ---------------------------------------------------------------------------
// Scope ID format — must be sha256 prefix in production
// ---------------------------------------------------------------------------

test.describe('scope ID format', () => {
    test('scope comment is present in the DOM', async ({ page }) => {
        const name = await readScopeName(page);

        expect(name).toBeTruthy();
    });

    test('scope ID is 8 characters long', async ({ page }) => {
        const name = await readScopeName(page);

        expect(name).toHaveLength(8);
    });

    test('scope ID is lowercase hexadecimal', async ({ page }) => {
        const name = await readScopeName(page);

        expect(name).toMatch(/^[0-9a-f]{8}$/);
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

                if (text.startsWith('wire-scope:')) {
                    open = text.slice('wire-scope:'.length);
                } else if (text.startsWith('/wire-scope:')) {
                    close = text.slice('/wire-scope:'.length);
                }
            }

            return { open, close };
        });

        expect(open).toBeTruthy();
        expect(close).toBe(open);
    });
});

// ---------------------------------------------------------------------------
// Wire API — accessible via dynamic scope name
// ---------------------------------------------------------------------------

test.describe('Wire API in production mode', () => {
    test('Wire.get() with scope name read from DOM returns object', async ({ page }) => {
        const name = await readScopeName(page);
        const type = await page.evaluate((n) => typeof window.Wire.get(n), name);

        expect(type).toBe('object');
    });

    test('Wire.getAll() with scope name returns array of length 1', async ({ page }) => {
        const name = await readScopeName(page);
        const length = await page.evaluate((n) => window.Wire.getAll(n).length, name);

        expect(length).toBe(1);
    });

    test('Wire.snapshot() with scope name returns data', async ({ page }) => {
        const name = await readScopeName(page);
        const snap = await page.evaluate((n) => window.Wire.snapshot(n), name);

        expect(snap.user.name).toBe('Jason');
        expect(snap.user.email).toBe('jason@example.com');
    });
});

// ---------------------------------------------------------------------------
// Reactivity — bindings must work identically in production mode
// ---------------------------------------------------------------------------

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

    test('programmatic mutation via dynamic scope name updates DOM', async ({ page }) => {
        const name = await readScopeName(page);

        await page.evaluate((n) => { window.Wire.get(n).user.name = 'ProdBob'; }, name);

        await expect(page.locator('#name-heading')).toHaveText('ProdBob');
        await expect(page.locator('#name-input')).toHaveValue('ProdBob');
    });

    test('two-way binding works in production mode', async ({ page }) => {
        await page.locator('#name-input').fill('ProdTyped');

        await expect(page.locator('#name-heading')).toHaveText('ProdTyped');
    });

    test('snapshot reflects programmatic changes in production mode', async ({ page }) => {
        const name = await readScopeName(page);

        await page.evaluate((n) => { window.Wire.get(n).user.name = 'ProdSnap'; }, name);

        const snap = await page.evaluate((n) => window.Wire.snapshot(n), name);

        expect(snap.user.name).toBe('ProdSnap');
    });
});
