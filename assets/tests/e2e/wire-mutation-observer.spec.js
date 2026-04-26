import { test, expect } from '@playwright/test';

const ANCHOR = '#name-heading';

test.beforeEach(async ({ page }) => {
    await page.goto('/wire-test/full-fixture');
});

test.describe('dynamic element registration', () => {
    test('dynamically added element gets updated on next mutation', async ({ page }) => {
        await page.evaluate(() => {
            const span = document.createElement('span');
            span.id = 'dynamic-text';
            span.setAttribute('data-wire', 'user.name');
            span.textContent = 'placeholder';
            document.body.prepend(span);
        });

        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Dynamic'; }, ANCHOR);

        await expect(page.locator('#dynamic-text')).toHaveText('Dynamic');
    });

    test('dynamically added element is not updated before any mutation', async ({ page }) => {
        await page.evaluate(() => {
            const span = document.createElement('span');
            span.id = 'dynamic-text';
            span.setAttribute('data-wire', 'user.name');
            span.textContent = 'placeholder';
            document.body.prepend(span);
        });

        await expect(page.locator('#dynamic-text')).toHaveText('placeholder');
    });

    test('multiple dynamically added elements all get updated', async ({ page }) => {
        await page.evaluate(() => {
            for (let i = 0; i < 3; i++) {
                const span = document.createElement('span');
                span.className = 'dynamic-name';
                span.setAttribute('data-wire', 'user.name');
                span.textContent = 'placeholder';
                document.body.prepend(span);
            }
        });

        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Dynamic'; }, ANCHOR);

        await expect(page.locator('.dynamic-name')).toHaveCount(3);

        for (const el of await page.locator('.dynamic-name').all()) {
            await expect(el).toHaveText('Dynamic');
        }
    });

    test('dynamically added element tracks further mutations', async ({ page }) => {
        await page.evaluate(() => {
            const span = document.createElement('span');
            span.id = 'dynamic-text';
            span.setAttribute('data-wire', 'user.name');
            document.body.prepend(span);
        });

        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'First'; }, ANCHOR);
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Second'; }, ANCHOR);

        await expect(page.locator('#dynamic-text')).toHaveText('Second');
    });

    test('dynamically added element without data-wire is not registered', async ({ page }) => {
        await page.evaluate(() => {
            const div = document.createElement('div');
            div.id = 'no-wire-attr';
            div.textContent = 'untouched';
            document.body.prepend(div);
        });

        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Changed'; }, ANCHOR);

        await expect(page.locator('#no-wire-attr')).toHaveText('untouched');
    });

    test('dynamically added attribute-bound element gets updated on mutation', async ({ page }) => {
        await page.evaluate(() => {
            const div = document.createElement('div');
            div.id = 'dynamic-attr';
            div.setAttribute('data-wire', 'user.status:class');
            document.body.prepend(div);
        });

        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').status = 'pending'; }, ANCHOR);

        await expect(page.locator('#dynamic-attr')).toHaveAttribute('class', 'pending');
    });

    test('elements injected via innerHTML container are all registered', async ({ page }) => {
        await page.evaluate(() => {
            const container = document.createElement('div');
            container.innerHTML = `
                <span class="bulk-name" data-wire="user.name">a</span>
                <span class="bulk-name" data-wire="user.name">b</span>
            `;
            document.body.prepend(container);
        });

        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Bulk'; }, ANCHOR);

        for (const el of await page.locator('.bulk-name').all()) {
            await expect(el).toHaveText('Bulk');
        }
    });
});

test.describe('Wire.init() re-call', () => {
    test('Wire.init() is safe to call again without errors', async ({ page }) => {
        const error = await page.evaluate(() => {
            try {
                window.Wire.init();
                return null;
            } catch (e) {
                return e.message;
            }
        });

        expect(error).toBeNull();
    });

    test('existing bindings still work after Wire.init() re-call', async ({ page }) => {
        await page.evaluate(() => window.Wire.init());
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'AfterInit'; }, ANCHOR);
        await expect(page.locator('#name-heading')).toHaveText('AfterInit');
    });
});
