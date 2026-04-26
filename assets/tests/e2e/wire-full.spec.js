import { test, expect } from '@playwright/test';

const ANCHOR = '#name-heading';

test.beforeEach(async ({ page }) => {
    await page.goto('/wire-test/full-fixture');
});

test.describe('initial render', () => {
    test('text binding renders name', async ({ page }) => {
        await expect(page.locator('#name-heading')).toHaveText('Jason');
    });

    test('second text binding on same path renders name', async ({ page }) => {
        await expect(page.locator('#name-copy')).toHaveText('Jason');
    });

    test('title attribute binding is set from data', async ({ page }) => {
        await expect(page.locator('#name-title')).toHaveAttribute('title', 'Jason');
    });

    test('text binding renders email', async ({ page }) => {
        await expect(page.locator('#email-text')).toHaveText('jason@example.com');
    });

    test('class attribute binding is set from data', async ({ page }) => {
        await expect(page.locator('#status-class')).toHaveAttribute('class', 'active');
    });

    test('value binding sets input value for name', async ({ page }) => {
        await expect(page.locator('#name-input')).toHaveValue('Jason');
    });

    test('value binding sets input value for email', async ({ page }) => {
        await expect(page.locator('#email-input')).toHaveValue('jason@example.com');
    });
});

test.describe('two-way binding', () => {
    test('typing in name input updates the heading', async ({ page }) => {
        await page.locator('#name-input').fill('Alice');
        await expect(page.locator('#name-heading')).toHaveText('Alice');
    });

    test('typing in name input updates the second text binding', async ({ page }) => {
        await page.locator('#name-input').fill('Alice');
        await expect(page.locator('#name-copy')).toHaveText('Alice');
    });

    test('typing in name input updates the title attribute binding', async ({ page }) => {
        await page.locator('#name-input').fill('Alice');
        await expect(page.locator('#name-title')).toHaveAttribute('title', 'Alice');
    });

    test('typing in email input updates the email text binding', async ({ page }) => {
        await page.locator('#email-input').fill('new@example.com');
        await expect(page.locator('#email-text')).toHaveText('new@example.com');
    });

    test('clearing the name input empties all name bindings', async ({ page }) => {
        await page.locator('#name-input').fill('');
        await expect(page.locator('#name-heading')).toHaveText('');
        await expect(page.locator('#name-copy')).toHaveText('');
    });

    test('name and email inputs are independent', async ({ page }) => {
        await page.locator('#name-input').fill('Bob');
        await expect(page.locator('#email-text')).toHaveText('jason@example.com');
    });
});

test.describe('programmatic update via scope.get()', () => {
    test('setting user.name updates the heading', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Bob'; }, ANCHOR);
        await expect(page.locator('#name-heading')).toHaveText('Bob');
    });

    test('setting user.name updates the second text binding', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Bob'; }, ANCHOR);
        await expect(page.locator('#name-copy')).toHaveText('Bob');
    });

    test('setting user.name updates the title attribute binding', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Bob'; }, ANCHOR);
        await expect(page.locator('#name-title')).toHaveAttribute('title', 'Bob');
    });

    test('setting user.name updates the value input', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Bob'; }, ANCHOR);
        await expect(page.locator('#name-input')).toHaveValue('Bob');
    });

    test('setting user.email updates the email text', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').email = 'changed@example.com'; }, ANCHOR);
        await expect(page.locator('#email-text')).toHaveText('changed@example.com');
    });

    test('setting user.status updates the class attribute', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').status = 'inactive'; }, ANCHOR);
        await expect(page.locator('#status-class')).toHaveAttribute('class', 'inactive');
    });

    test('setting user.name to empty string clears all name bindings', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = ''; }, ANCHOR);
        await expect(page.locator('#name-heading')).toHaveText('');
        await expect(page.locator('#name-copy')).toHaveText('');
        await expect(page.locator('#name-input')).toHaveValue('');
    });

    test('setting user.name twice keeps the last value', async ({ page }) => {
        await page.evaluate((sel) => {
            window.Wire.getScope(document.querySelector(sel)).get('user').name = 'First';
            window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Second';
        }, ANCHOR);
        await expect(page.locator('#name-heading')).toHaveText('Second');
    });

    test('name and email updates are independent', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Only Name Changed'; }, ANCHOR);
        await expect(page.locator('#email-text')).toHaveText('jason@example.com');
    });
});

test.describe('Wire API', () => {
    test('Wire global object exists on window', async ({ page }) => {
        const exists = await page.evaluate(() => typeof window.Wire !== 'undefined');
        expect(exists).toBe(true);
    });

    test('Wire.init is a function', async ({ page }) => {
        const isFunction = await page.evaluate(() => typeof window.Wire.init === 'function');
        expect(isFunction).toBe(true);
    });

    test('Wire.getScope is a function', async ({ page }) => {
        const isFunction = await page.evaluate(() => typeof window.Wire.getScope === 'function');
        expect(isFunction).toBe(true);
    });

    test('Wire.submit is a function', async ({ page }) => {
        const isFunction = await page.evaluate(() => typeof window.Wire.submit === 'function');
        expect(isFunction).toBe(true);
    });

    test('Wire.getScope(insideScope) returns object with get + getSnapshot', async ({ page }) => {
        const shape = await page.evaluate((sel) => {
            const scope = window.Wire.getScope(document.querySelector(sel));
            return { get: typeof scope?.get, getSnapshot: typeof scope?.getSnapshot };
        }, ANCHOR);
        expect(shape).toEqual({ get: 'function', getSnapshot: 'function' });
    });

    test('Wire.getScope(detachedElement) returns null', async ({ page }) => {
        const result = await page.evaluate(() => window.Wire.getScope(document.createElement('div')));
        expect(result).toBeNull();
    });

    test('scope.get(unknownVar) returns undefined', async ({ page }) => {
        const value = await page.evaluate((sel) => window.Wire.getScope(document.querySelector(sel)).get('nonexistent'), ANCHOR);
        expect(value).toBeUndefined();
    });

    test('scope.getSnapshot() returns current data', async ({ page }) => {
        const snap = await page.evaluate((sel) => window.Wire.getScope(document.querySelector(sel)).getSnapshot(), ANCHOR);
        expect(snap.user.name).toBe('Jason');
        expect(snap.user.email).toBe('jason@example.com');
        expect(snap.user.status).toBe('active');
    });

    test('scope.getSnapshot(name) returns just that variable', async ({ page }) => {
        const user = await page.evaluate((sel) => window.Wire.getScope(document.querySelector(sel)).getSnapshot('user'), ANCHOR);
        expect(user.name).toBe('Jason');
    });

    test('scope.snapshot strips identity tags', async ({ page }) => {
        const snap = await page.evaluate((sel) => window.Wire.getScope(document.querySelector(sel)).getSnapshot(), ANCHOR);
        expect(snap.user.__class).toBeUndefined();
        expect(snap.user.__id).toBeUndefined();
        expect(snap.user.__submit).toBeUndefined();
    });

    test('snapshot is a deep clone — mutations do not affect live data', async ({ page }) => {
        await page.evaluate((sel) => {
            const snap = window.Wire.getScope(document.querySelector(sel)).getSnapshot();
            snap.user.name = 'MUTATED';
        }, ANCHOR);
        await expect(page.locator('#name-heading')).toHaveText('Jason');
    });

    test('snapshot reflects programmatic changes', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Updated'; }, ANCHOR);
        const snap = await page.evaluate((sel) => window.Wire.getScope(document.querySelector(sel)).getSnapshot(), ANCHOR);
        expect(snap.user.name).toBe('Updated');
    });
});

test.describe('scope ID', () => {
    test('scope comment is present in the DOM', async ({ page }) => {
        const found = await page.evaluate(() => {
            const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
            let node;
            while ((node = walker.nextNode())) {
                if (node.textContent.trim().startsWith('wire-scope:')) return true;
            }
            return false;
        });
        expect(found).toBe(true);
    });

    test('in debug mode scope name equals template path', async ({ page }) => {
        const name = await page.evaluate(() => {
            const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
            let node;
            while ((node = walker.nextNode())) {
                const text = node.textContent.trim();
                if (text.startsWith('wire-scope:')) return text.slice('wire-scope:'.length);
            }
            return null;
        });
        expect(name).toBe('wire_test/full.html.twig');
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

test.describe('edge cases', () => {
    test('setting the same value multiple times does not break bindings', async ({ page }) => {
        for (let i = 0; i < 5; i++) {
            await page.evaluate(([sel, index]) => {
                window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Value' + index;
            }, [ANCHOR, i]);
        }
        await expect(page.locator('#name-heading')).toHaveText('Value4');
    });

    test('two-way then programmatic: last write wins', async ({ page }) => {
        await page.locator('#name-input').fill('FromInput');
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'FromCode'; }, ANCHOR);
        await expect(page.locator('#name-heading')).toHaveText('FromCode');
    });

    test('programmatic then two-way: last write wins', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'FromCode'; }, ANCHOR);
        await page.locator('#name-input').fill('FromInput');
        await expect(page.locator('#name-heading')).toHaveText('FromInput');
    });

    test('snapshot after two-way input reflects typed value', async ({ page }) => {
        await page.locator('#name-input').fill('TypedValue');
        const snap = await page.evaluate((sel) => window.Wire.getScope(document.querySelector(sel)).getSnapshot(), ANCHOR);
        expect(snap.user.name).toBe('TypedValue');
    });

    test('page reload restores original data', async ({ page }) => {
        await page.evaluate((sel) => { window.Wire.getScope(document.querySelector(sel)).get('user').name = 'Changed'; }, ANCHOR);
        await page.reload();
        await expect(page.locator('#name-heading')).toHaveText('Jason');
    });
});
