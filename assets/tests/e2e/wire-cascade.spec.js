import { test, expect } from '@playwright/test';

const PARENT_SCOPE = 'wire_test/cascade_parent.html.twig';
const CHILD_SCOPE = 'wire_test/cascade_child.html.twig';

test.beforeEach(async ({ page }) => {
    await page.goto('/wire-test/cascade-fixture');
});

// ---------------------------------------------------------------------------
// Initial render — both parent and child are scoped
// ---------------------------------------------------------------------------

test.describe('initial render', () => {
    test('parent renders name', async ({ page }) => {
        await expect(page.locator('#cascade-parent-name')).toHaveText('Jason');
    });

    test('parent renders email', async ({ page }) => {
        await expect(page.locator('#cascade-parent-email')).toHaveText('jason@example.com');
    });

    test('child renders name', async ({ page }) => {
        await expect(page.locator('#cascade-child-name')).toHaveText('Jason');
    });

    test('child renders email', async ({ page }) => {
        await expect(page.locator('#cascade-child-email')).toHaveText('jason@example.com');
    });
});

// ---------------------------------------------------------------------------
// Both scopes are registered with Wire
// ---------------------------------------------------------------------------

test.describe('Wire scope registration', () => {
    test('parent scope comment is present in DOM', async ({ page }) => {
        const found = await page.evaluate((scope) => {
            const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
            let node;

            while ((node = walker.nextNode())) {
                if (node.textContent.trim() === `wire-scope:${scope}`) {
                    return true;
                }
            }

            return false;
        }, PARENT_SCOPE);

        expect(found).toBe(true);
    });

    test('child scope comment is present in DOM (cascade worked)', async ({ page }) => {
        const found = await page.evaluate((scope) => {
            const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
            let node;

            while ((node = walker.nextNode())) {
                if (node.textContent.trim() === `wire-scope:${scope}`) {
                    return true;
                }
            }

            return false;
        }, CHILD_SCOPE);

        expect(found).toBe(true);
    });

    test('Wire.get(parentScope) returns object', async ({ page }) => {
        const type = await page.evaluate((scope) => typeof window.Wire.get(scope), PARENT_SCOPE);

        expect(type).toBe('object');
    });

    test('Wire.get(childScope) returns object', async ({ page }) => {
        const type = await page.evaluate((scope) => typeof window.Wire.get(scope), CHILD_SCOPE);

        expect(type).toBe('object');
    });

    test('both scopes appear in Wire.snapshot() all-scopes', async ({ page }) => {
        const all = await page.evaluate(() => window.Wire.snapshot());
        const names = all.map(s => s.scope);

        expect(names).toContain(PARENT_SCOPE);
        expect(names).toContain(CHILD_SCOPE);
    });
});

// ---------------------------------------------------------------------------
// Cross-scope propagation via cascade (shared user object)
// ---------------------------------------------------------------------------

test.describe('cross-scope propagation', () => {
    test('mutating parent proxy updates parent DOM', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'Bob'; }, PARENT_SCOPE);

        await expect(page.locator('#cascade-parent-name')).toHaveText('Bob');
    });

    test('mutating parent proxy updates child DOM', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'Bob'; }, PARENT_SCOPE);

        await expect(page.locator('#cascade-child-name')).toHaveText('Bob');
    });

    test('mutating child proxy updates child DOM', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'Alice'; }, CHILD_SCOPE);

        await expect(page.locator('#cascade-child-name')).toHaveText('Alice');
    });

    test('mutating child proxy updates parent DOM', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'Alice'; }, CHILD_SCOPE);

        await expect(page.locator('#cascade-parent-name')).toHaveText('Alice');
    });

    test('mutating parent email updates child email', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.email = 'new@example.com'; }, PARENT_SCOPE);

        await expect(page.locator('#cascade-child-email')).toHaveText('new@example.com');
    });

    test('mutating child email updates parent email', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.email = 'other@example.com'; }, CHILD_SCOPE);

        await expect(page.locator('#cascade-parent-email')).toHaveText('other@example.com');
    });
});

// ---------------------------------------------------------------------------
// Snapshot consistency
// ---------------------------------------------------------------------------

test.describe('snapshot consistency', () => {
    test('parent snapshot has correct initial data', async ({ page }) => {
        const snap = await page.evaluate((scope) => window.Wire.snapshot(scope), PARENT_SCOPE);

        expect(snap.user.name).toBe('Jason');
        expect(snap.user.email).toBe('jason@example.com');
    });

    test('child snapshot has correct initial data', async ({ page }) => {
        const snap = await page.evaluate((scope) => window.Wire.snapshot(scope), CHILD_SCOPE);

        expect(snap.user.name).toBe('Jason');
    });

    test('after mutating parent, child snapshot reflects change', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'Bob'; }, PARENT_SCOPE);

        const snap = await page.evaluate((scope) => window.Wire.snapshot(scope), CHILD_SCOPE);

        expect(snap.user.name).toBe('Bob');
    });

    test('after mutating child, parent snapshot reflects change', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'Alice'; }, CHILD_SCOPE);

        const snap = await page.evaluate((scope) => window.Wire.snapshot(scope), PARENT_SCOPE);

        expect(snap.user.name).toBe('Alice');
    });
});
