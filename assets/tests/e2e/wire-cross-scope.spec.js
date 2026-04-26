import { test, expect } from '@playwright/test';

const SCOPE_A = 'wire_test/_cross_a.html.twig';
const SCOPE_B = 'wire_test/_cross_b.html.twig';

test.beforeEach(async ({ page }) => {
    await page.goto('/wire-test/cross-scope-fixture');
});

// ---------------------------------------------------------------------------
// Initial render
// ---------------------------------------------------------------------------

test.describe('initial render', () => {
    test('scope A renders name', async ({ page }) => {
        await expect(page.locator('#cross-a-name')).toHaveText('Jason');
    });

    test('scope B renders name', async ({ page }) => {
        await expect(page.locator('#cross-b-name')).toHaveText('Jason');
    });

    test('scope A renders email', async ({ page }) => {
        await expect(page.locator('#cross-a-email')).toHaveText('jason@example.com');
    });

    test('scope B renders email', async ({ page }) => {
        await expect(page.locator('#cross-b-email')).toHaveText('jason@example.com');
    });

    test('scope A input has correct initial value', async ({ page }) => {
        await expect(page.locator('#cross-a-input')).toHaveValue('Jason');
    });

    test('scope B input has correct initial value', async ({ page }) => {
        await expect(page.locator('#cross-b-input')).toHaveValue('Jason');
    });
});

// ---------------------------------------------------------------------------
// Cross-scope propagation — mutating scope A updates scope B and vice versa
// ---------------------------------------------------------------------------

test.describe('cross-scope propagation', () => {
    test('mutating scope A proxy updates scope B text binding', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'Bob'; }, SCOPE_A);

        await expect(page.locator('#cross-b-name')).toHaveText('Bob');
    });

    test('mutating scope A proxy updates scope A text binding', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'Bob'; }, SCOPE_A);

        await expect(page.locator('#cross-a-name')).toHaveText('Bob');
    });

    test('mutating scope B proxy updates scope A text binding', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'Alice'; }, SCOPE_B);

        await expect(page.locator('#cross-a-name')).toHaveText('Alice');
    });

    test('mutating scope B proxy updates scope B text binding', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'Alice'; }, SCOPE_B);

        await expect(page.locator('#cross-b-name')).toHaveText('Alice');
    });

    test('mutating scope A proxy updates scope B value input', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'Bob'; }, SCOPE_A);

        await expect(page.locator('#cross-b-input')).toHaveValue('Bob');
    });

    test('mutating scope B proxy updates scope A value input', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'Alice'; }, SCOPE_B);

        await expect(page.locator('#cross-a-input')).toHaveValue('Alice');
    });

    test('mutating scope A email updates scope B email', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.email = 'new@example.com'; }, SCOPE_A);

        await expect(page.locator('#cross-b-email')).toHaveText('new@example.com');
    });

    test('mutating scope B email updates scope A email', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.email = 'other@example.com'; }, SCOPE_B);

        await expect(page.locator('#cross-a-email')).toHaveText('other@example.com');
    });
});

// ---------------------------------------------------------------------------
// Two-way binding cross-scope propagation
// ---------------------------------------------------------------------------

test.describe('two-way binding cross-scope', () => {
    test('typing in scope A input updates scope B text', async ({ page }) => {
        await page.locator('#cross-a-input').fill('Typed');

        await expect(page.locator('#cross-b-name')).toHaveText('Typed');
    });

    test('typing in scope B input updates scope A text', async ({ page }) => {
        await page.locator('#cross-b-input').fill('Typed');

        await expect(page.locator('#cross-a-name')).toHaveText('Typed');
    });

    test('typing in scope A input also updates scope A input value', async ({ page }) => {
        await page.locator('#cross-a-input').fill('Typed');

        await expect(page.locator('#cross-b-input')).toHaveValue('Typed');
    });
});

// ---------------------------------------------------------------------------
// Snapshot consistency
// ---------------------------------------------------------------------------

test.describe('snapshot consistency', () => {
    test('snapshot of scope A reflects name', async ({ page }) => {
        const snap = await page.evaluate((scope) => window.Wire.snapshot(scope), SCOPE_A);

        expect(snap.user.name).toBe('Jason');
    });

    test('after mutating scope A, snapshot of scope B reflects change', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'Bob'; }, SCOPE_A);

        const snap = await page.evaluate((scope) => window.Wire.snapshot(scope), SCOPE_B);

        expect(snap.user.name).toBe('Bob');
    });

    test('after mutating scope B, snapshot of scope A reflects change', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'Alice'; }, SCOPE_B);

        const snap = await page.evaluate((scope) => window.Wire.snapshot(scope), SCOPE_A);

        expect(snap.user.name).toBe('Alice');
    });

    test('both scopes exist in Wire.snapshot() all-scopes output', async ({ page }) => {
        const all = await page.evaluate(() => window.Wire.snapshot());
        const names = all.map(s => s.scope);

        expect(names).toContain(SCOPE_A);
        expect(names).toContain(SCOPE_B);
    });
});

// ---------------------------------------------------------------------------
// Wire API — both scopes accessible
// ---------------------------------------------------------------------------

test.describe('Wire API', () => {
    test('Wire.get(scopeA) returns object', async ({ page }) => {
        const type = await page.evaluate((scope) => typeof window.Wire.get(scope), SCOPE_A);

        expect(type).toBe('object');
    });

    test('Wire.get(scopeB) returns object', async ({ page }) => {
        const type = await page.evaluate((scope) => typeof window.Wire.get(scope), SCOPE_B);

        expect(type).toBe('object');
    });

    test('Wire.getAll(scopeA) returns array of length 1', async ({ page }) => {
        const length = await page.evaluate((scope) => window.Wire.getAll(scope).length, SCOPE_A);

        expect(length).toBe(1);
    });

    test('Wire.getAll(scopeB) returns array of length 1', async ({ page }) => {
        const length = await page.evaluate((scope) => window.Wire.getAll(scope).length, SCOPE_B);

        expect(length).toBe(1);
    });

    test('clearing name via scope A empties both text bindings', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = ''; }, SCOPE_A);

        await expect(page.locator('#cross-a-name')).toHaveText('');
        await expect(page.locator('#cross-b-name')).toHaveText('');
    });
});

// ---------------------------------------------------------------------------
// Scope comments present for both scopes
// ---------------------------------------------------------------------------

test.describe('DOM structure', () => {
    test('scope A comment is present', async ({ page }) => {
        const found = await page.evaluate((scope) => {
            const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
            let node;

            while ((node = walker.nextNode())) {
                if (node.textContent.trim() === `wire-scope:${scope}`) {
                    return true;
                }
            }

            return false;
        }, SCOPE_A);

        expect(found).toBe(true);
    });

    test('scope B comment is present', async ({ page }) => {
        const found = await page.evaluate((scope) => {
            const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
            let node;

            while ((node = walker.nextNode())) {
                if (node.textContent.trim() === `wire-scope:${scope}`) {
                    return true;
                }
            }

            return false;
        }, SCOPE_B);

        expect(found).toBe(true);
    });
});
