import { test, expect } from '@playwright/test';

const A_ANCHOR = '#cross-a-name';
const B_ANCHOR = '#cross-b-name';

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
// Cross-scope propagation
// ---------------------------------------------------------------------------

test.describe('cross-scope propagation', () => {
    test('mutating scope A user updates scope B text binding', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Bob'; }, A_ANCHOR);
        await expect(page.locator('#cross-b-name')).toHaveText('Bob');
    });

    test('mutating scope A user updates scope A text binding', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Bob'; }, A_ANCHOR);
        await expect(page.locator('#cross-a-name')).toHaveText('Bob');
    });

    test('mutating scope B user updates scope A text binding', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Alice'; }, B_ANCHOR);
        await expect(page.locator('#cross-a-name')).toHaveText('Alice');
    });

    test('mutating scope B user updates scope B text binding', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Alice'; }, B_ANCHOR);
        await expect(page.locator('#cross-b-name')).toHaveText('Alice');
    });

    test('mutating scope A user updates scope B value input', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Bob'; }, A_ANCHOR);
        await expect(page.locator('#cross-b-input')).toHaveValue('Bob');
    });

    test('mutating scope B user updates scope A value input', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Alice'; }, B_ANCHOR);
        await expect(page.locator('#cross-a-input')).toHaveValue('Alice');
    });

    test('mutating scope A email updates scope B email', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').email = 'new@example.com'; }, A_ANCHOR);
        await expect(page.locator('#cross-b-email')).toHaveText('new@example.com');
    });

    test('mutating scope B email updates scope A email', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').email = 'other@example.com'; }, B_ANCHOR);
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

    test('typing in scope A input also updates scope B input value', async ({ page }) => {
        await page.locator('#cross-a-input').fill('Typed');
        await expect(page.locator('#cross-b-input')).toHaveValue('Typed');
    });
});

// ---------------------------------------------------------------------------
// Snapshot consistency
// ---------------------------------------------------------------------------

test.describe('snapshot consistency', () => {
    test('scope A snapshot reflects name', async ({ page }) => {
        const snap = await page.evaluate((sel) => window.Wire.getScope(document.querySelector(sel)).getSnapshot(), A_ANCHOR);
        expect(snap.user.name).toBe('Jason');
    });

    test('after mutating scope A, scope B snapshot reflects change', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Bob'; }, A_ANCHOR);
        const snap = await page.evaluate((sel) => window.Wire.getScope(document.querySelector(sel)).getSnapshot(), B_ANCHOR);
        expect(snap.user.name).toBe('Bob');
    });

    test('after mutating scope B, scope A snapshot reflects change', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Alice'; }, B_ANCHOR);
        const snap = await page.evaluate((sel) => window.Wire.getScope(document.querySelector(sel)).getSnapshot(), A_ANCHOR);
        expect(snap.user.name).toBe('Alice');
    });

    test('snapshot strips identity tags', async ({ page }) => {
        const snap = await page.evaluate((sel) => window.Wire.getScope(document.querySelector(sel)).getSnapshot(), A_ANCHOR);
        expect(snap.user.__class).toBeUndefined();
        expect(snap.user.__id).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Scope handle behaviour
// ---------------------------------------------------------------------------

test.describe('Wire.getScope', () => {
    test('returns object for elements inside scope A', async ({ page }) => {
        const type = await page.evaluate((sel) => typeof window.Wire.getScope(document.querySelector(sel)), A_ANCHOR);
        expect(type).toBe('object');
    });

    test('returns object for elements inside scope B', async ({ page }) => {
        const type = await page.evaluate((sel) => typeof window.Wire.getScope(document.querySelector(sel)), B_ANCHOR);
        expect(type).toBe('object');
    });

    test('returns null for elements outside any scope', async ({ page }) => {
        const result = await page.evaluate(() => window.Wire.getScope(document.documentElement));
        expect(result).toBeNull();
    });

    test('clearing name via scope A empties both text bindings', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = ''; }, A_ANCHOR);
        await expect(page.locator('#cross-a-name')).toHaveText('');
        await expect(page.locator('#cross-b-name')).toHaveText('');
    });
});

// ---------------------------------------------------------------------------
// Scope comments
// ---------------------------------------------------------------------------

test.describe('DOM structure', () => {
    test('two wire-scope start markers are present', async ({ page }) => {
        const count = await page.evaluate(() => {
            const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
            let node, n = 0;
            while ((node = walker.nextNode())) {
                if (node.textContent.trim().startsWith('wire-scope:')) n++;
            }
            return n;
        });
        expect(count).toBe(2);
    });
});
