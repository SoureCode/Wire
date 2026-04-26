import { test, expect } from '@playwright/test';

const PARENT_ANCHOR = '#cascade-parent-name';
const CHILD_ANCHOR = '#cascade-child-name';

test.beforeEach(async ({ page }) => {
    await page.goto('/wire-test/cascade-fixture');
});

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

test.describe('Wire scope registration', () => {
    test('two wire-scope start markers exist (parent + child)', async ({ page }) => {
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

    test('parent anchor has its own scope', async ({ page }) => {
        const type = await page.evaluate((sel) => typeof window.Wire.getScope(document.querySelector(sel)), PARENT_ANCHOR);
        expect(type).toBe('object');
    });

    test('child anchor has its own scope', async ({ page }) => {
        const type = await page.evaluate((sel) => typeof window.Wire.getScope(document.querySelector(sel)), CHILD_ANCHOR);
        expect(type).toBe('object');
    });
});

test.describe('cross-scope propagation', () => {
    test('mutating parent user updates parent DOM', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Bob'; }, PARENT_ANCHOR);
        await expect(page.locator('#cascade-parent-name')).toHaveText('Bob');
    });

    test('mutating parent user updates child DOM', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Bob'; }, PARENT_ANCHOR);
        await expect(page.locator('#cascade-child-name')).toHaveText('Bob');
    });

    test('mutating child user updates child DOM', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Alice'; }, CHILD_ANCHOR);
        await expect(page.locator('#cascade-child-name')).toHaveText('Alice');
    });

    test('mutating child user updates parent DOM', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Alice'; }, CHILD_ANCHOR);
        await expect(page.locator('#cascade-parent-name')).toHaveText('Alice');
    });

    test('mutating parent email updates child email', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').email = 'new@example.com'; }, PARENT_ANCHOR);
        await expect(page.locator('#cascade-child-email')).toHaveText('new@example.com');
    });

    test('mutating child email updates parent email', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').email = 'other@example.com'; }, CHILD_ANCHOR);
        await expect(page.locator('#cascade-parent-email')).toHaveText('other@example.com');
    });
});

test.describe('snapshot consistency', () => {
    test('parent snapshot has correct initial data', async ({ page }) => {
        const snap = await page.evaluate((sel) => window.Wire.getScope(document.querySelector(sel)).snapshot(), PARENT_ANCHOR);
        expect(snap.user.name).toBe('Jason');
        expect(snap.user.email).toBe('jason@example.com');
    });

    test('child snapshot has correct initial data', async ({ page }) => {
        const snap = await page.evaluate((sel) => window.Wire.getScope(document.querySelector(sel)).snapshot(), CHILD_ANCHOR);
        expect(snap.user.name).toBe('Jason');
    });

    test('after mutating parent, child snapshot reflects change', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Bob'; }, PARENT_ANCHOR);
        const snap = await page.evaluate((sel) => window.Wire.getScope(document.querySelector(sel)).snapshot(), CHILD_ANCHOR);
        expect(snap.user.name).toBe('Bob');
    });

    test('after mutating child, parent snapshot reflects change', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Alice'; }, CHILD_ANCHOR);
        const snap = await page.evaluate((sel) => window.Wire.getScope(document.querySelector(sel)).snapshot(), PARENT_ANCHOR);
        expect(snap.user.name).toBe('Alice');
    });

    test('snapshot with variable name returns just that variable', async ({ page }) => {
        const just = await page.evaluate((sel) => window.Wire.getScope(document.querySelector(sel)).snapshot('user'), PARENT_ANCHOR);
        expect(just.name).toBe('Jason');
        expect(just.email).toBe('jason@example.com');
    });
});
