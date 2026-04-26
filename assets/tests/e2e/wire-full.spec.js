import { test, expect } from '@playwright/test';

const SCOPE = 'wire_test/full.html.twig';

test.beforeEach(async ({ page }) => {
    await page.goto('/wire-test/full-fixture');
});

// ---------------------------------------------------------------------------
// Initial render — Wire must apply all bindings on DOMContentLoaded
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Two-way binding — typing in an input propagates to all bound elements
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Programmatic update via Wire.get() — setting proxy properties updates DOM
// ---------------------------------------------------------------------------

test.describe('programmatic update via Wire.get()', () => {
    test('setting user.name updates the heading', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'Bob'; }, SCOPE);

        await expect(page.locator('#name-heading')).toHaveText('Bob');
    });

    test('setting user.name updates the second text binding', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'Bob'; }, SCOPE);

        await expect(page.locator('#name-copy')).toHaveText('Bob');
    });

    test('setting user.name updates the title attribute binding', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'Bob'; }, SCOPE);

        await expect(page.locator('#name-title')).toHaveAttribute('title', 'Bob');
    });

    test('setting user.name updates the value input', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'Bob'; }, SCOPE);

        await expect(page.locator('#name-input')).toHaveValue('Bob');
    });

    test('setting user.email updates the email text', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.email = 'changed@example.com'; }, SCOPE);

        await expect(page.locator('#email-text')).toHaveText('changed@example.com');
    });

    test('setting user.status updates the class attribute', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.status = 'inactive'; }, SCOPE);

        await expect(page.locator('#status-class')).toHaveAttribute('class', 'inactive');
    });

    test('setting user.name to empty string clears all name bindings', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = ''; }, SCOPE);

        await expect(page.locator('#name-heading')).toHaveText('');
        await expect(page.locator('#name-copy')).toHaveText('');
        await expect(page.locator('#name-input')).toHaveValue('');
    });

    test('setting user.name twice keeps the last value', async ({ page }) => {
        await page.evaluate((scope) => {
            window.Wire.get(scope).user.name = 'First';
            window.Wire.get(scope).user.name = 'Second';
        }, SCOPE);

        await expect(page.locator('#name-heading')).toHaveText('Second');
    });

    test('name and email updates are independent', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'Only Name Changed'; }, SCOPE);

        await expect(page.locator('#email-text')).toHaveText('jason@example.com');
    });
});

// ---------------------------------------------------------------------------
// Wire API surface
// ---------------------------------------------------------------------------

test.describe('Wire API', () => {
    test('Wire global object exists on window', async ({ page }) => {
        const exists = await page.evaluate(() => typeof window.Wire !== 'undefined');

        expect(exists).toBe(true);
    });

    test('Wire.init is a function', async ({ page }) => {
        const isFunction = await page.evaluate(() => typeof window.Wire.init === 'function');

        expect(isFunction).toBe(true);
    });

    test('Wire.get is a function', async ({ page }) => {
        const isFunction = await page.evaluate(() => typeof window.Wire.get === 'function');

        expect(isFunction).toBe(true);
    });

    test('Wire.getAll is a function', async ({ page }) => {
        const isFunction = await page.evaluate(() => typeof window.Wire.getAll === 'function');

        expect(isFunction).toBe(true);
    });

    test('Wire.snapshot is a function', async ({ page }) => {
        const isFunction = await page.evaluate(() => typeof window.Wire.snapshot === 'function');

        expect(isFunction).toBe(true);
    });

    test('Wire.get(knownScope) returns an object', async ({ page }) => {
        const type = await page.evaluate((scope) => typeof window.Wire.get(scope), SCOPE);

        expect(type).toBe('object');
    });

    test('Wire.get(unknownScope) returns undefined', async ({ page }) => {
        const value = await page.evaluate(() => window.Wire.get('nonexistent'));

        expect(value).toBeUndefined();
    });

    test('Wire.getAll(knownScope) returns array of length 1', async ({ page }) => {
        const length = await page.evaluate((scope) => window.Wire.getAll(scope).length, SCOPE);

        expect(length).toBe(1);
    });

    test('Wire.getAll(unknownScope) returns empty array', async ({ page }) => {
        const length = await page.evaluate(() => window.Wire.getAll('nonexistent').length);

        expect(length).toBe(0);
    });

    test('Wire.snapshot(knownScope) returns current data', async ({ page }) => {
        const snap = await page.evaluate((scope) => window.Wire.snapshot(scope), SCOPE);

        expect(snap.user.name).toBe('Jason');
        expect(snap.user.email).toBe('jason@example.com');
        expect(snap.user.status).toBe('active');
    });

    test('Wire.snapshot() without args returns array of all scopes', async ({ page }) => {
        const all = await page.evaluate(() => window.Wire.snapshot());

        expect(Array.isArray(all)).toBe(true);
        expect(all.length).toBeGreaterThan(0);
        expect(all[0]).toHaveProperty('scope');
        expect(all[0]).toHaveProperty('data');
    });

    test('Wire.snapshot(unknownScope) returns null', async ({ page }) => {
        const result = await page.evaluate(() => window.Wire.snapshot('nonexistent'));

        expect(result).toBeNull();
    });

    test('snapshot is a deep clone — mutations do not affect live data', async ({ page }) => {
        await page.evaluate((scope) => {
            const snap = window.Wire.snapshot(scope);

            snap.user.name = 'MUTATED';
        }, SCOPE);

        await expect(page.locator('#name-heading')).toHaveText('Jason');
    });

    test('snapshot reflects programmatic changes', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'Updated'; }, SCOPE);

        const snap = await page.evaluate((scope) => window.Wire.snapshot(scope), SCOPE);

        expect(snap.user.name).toBe('Updated');
    });
});

// ---------------------------------------------------------------------------
// Scope ID format — verifies debug vs prod naming behaviour
// ---------------------------------------------------------------------------

test.describe('scope ID', () => {
    test('scope comment is present in the DOM', async ({ page }) => {
        const found = await page.evaluate(() => {
            const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
            let node;

            while ((node = walker.nextNode())) {
                if (node.textContent.trim().startsWith('wire-scope:')) {
                    return true;
                }
            }

            return false;
        });

        expect(found).toBe(true);
    });

    test('scope name is non-empty', async ({ page }) => {
        const name = await page.evaluate(() => {
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

        expect(name).toBeTruthy();
    });

    test('in debug mode scope name equals template path', async ({ page }) => {
        const name = await page.evaluate(() => {
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

        expect(name).toBe('wire_test/full.html.twig');
    });

    test('Wire.get() with scope name read from DOM returns a proxy', async ({ page }) => {
        const result = await page.evaluate(() => {
            const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
            let node;

            while ((node = walker.nextNode())) {
                const text = node.textContent.trim();

                if (text.startsWith('wire-scope:')) {
                    const name = text.slice('wire-scope:'.length);

                    return typeof window.Wire.get(name);
                }
            }

            return null;
        });

        expect(result).toBe('object');
    });

    test('Wire.snapshot() with scope name read from DOM returns data', async ({ page }) => {
        const snap = await page.evaluate(() => {
            const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
            let node;

            while ((node = walker.nextNode())) {
                const text = node.textContent.trim();

                if (text.startsWith('wire-scope:')) {
                    return window.Wire.snapshot(text.slice('wire-scope:'.length));
                }
            }

            return null;
        });

        expect(snap).not.toBeNull();
        expect(snap.user.name).toBe('Jason');
    });

    test('closing scope comment matches opening scope comment', async ({ page }) => {
        const { open, close } = await page.evaluate(() => {
            const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
            let node;
            let open = null;
            let close = null;

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
// Edge cases
// ---------------------------------------------------------------------------

test.describe('edge cases', () => {
    test('setting the same value multiple times does not break bindings', async ({ page }) => {
        for (let i = 0; i < 5; i++) {
            await page.evaluate(([scope, index]) => {
                window.Wire.get(scope).user.name = 'Value' + index;
            }, [SCOPE, i]);
        }

        await expect(page.locator('#name-heading')).toHaveText('Value4');
    });

    test('two-way then programmatic: last write wins', async ({ page }) => {
        await page.locator('#name-input').fill('FromInput');
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'FromCode'; }, SCOPE);

        await expect(page.locator('#name-heading')).toHaveText('FromCode');
    });

    test('programmatic then two-way: last write wins', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'FromCode'; }, SCOPE);
        await page.locator('#name-input').fill('FromInput');

        await expect(page.locator('#name-heading')).toHaveText('FromInput');
    });

    test('Wire.snapshot after two-way input reflects typed value', async ({ page }) => {
        await page.locator('#name-input').fill('TypedValue');

        const snap = await page.evaluate((scope) => window.Wire.snapshot(scope), SCOPE);

        expect(snap.user.name).toBe('TypedValue');
    });

    test('page reload restores original data', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope).user.name = 'Changed'; }, SCOPE);
        await page.reload();

        await expect(page.locator('#name-heading')).toHaveText('Jason');
    });
});
