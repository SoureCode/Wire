import { test, expect } from '@playwright/test';

const CARD_SCOPE = 'wire_test/_user_card.html.twig';

test.beforeEach(async ({ page }) => {
    await page.goto('/wire-test/multi-fixture');
});

// ---------------------------------------------------------------------------
// Initial render — three cards on the page
// ---------------------------------------------------------------------------

test.describe('initial render', () => {
    test('three user cards are rendered', async ({ page }) => {
        await expect(page.locator('.user-card')).toHaveCount(3);
    });

    test('first card shows Alice', async ({ page }) => {
        await expect(page.locator('.user-card').nth(0).locator('.card-name')).toHaveText('Alice');
    });

    test('second card shows Bob', async ({ page }) => {
        await expect(page.locator('.user-card').nth(1).locator('.card-name')).toHaveText('Bob');
    });

    test('third card shows Carol', async ({ page }) => {
        await expect(page.locator('.user-card').nth(2).locator('.card-name')).toHaveText('Carol');
    });

    test('first card shows alice@example.com', async ({ page }) => {
        await expect(page.locator('.user-card').nth(0).locator('.card-email')).toHaveText('alice@example.com');
    });

    test('second card shows bob@example.com', async ({ page }) => {
        await expect(page.locator('.user-card').nth(1).locator('.card-email')).toHaveText('bob@example.com');
    });

    test('first card status class is active', async ({ page }) => {
        await expect(page.locator('.user-card').nth(0).locator('[data-wire="user.status:class"]')).toHaveAttribute('class', 'active');
    });

    test('second card status class is inactive', async ({ page }) => {
        await expect(page.locator('.user-card').nth(1).locator('[data-wire="user.status:class"]')).toHaveAttribute('class', 'inactive');
    });
});

// ---------------------------------------------------------------------------
// Wire.getAll() — returns all instances
// ---------------------------------------------------------------------------

test.describe('Wire.getAll()', () => {
    test('getAll returns array of length 3', async ({ page }) => {
        const length = await page.evaluate((scope) => window.Wire.getAll(scope).length, CARD_SCOPE);

        expect(length).toBe(3);
    });

    test('getAll(unknown) returns empty array', async ({ page }) => {
        const length = await page.evaluate(() => window.Wire.getAll('nonexistent').length);

        expect(length).toBe(0);
    });

    test('getAll returns proxies (objects)', async ({ page }) => {
        const types = await page.evaluate((scope) => window.Wire.getAll(scope).map(p => typeof p), CARD_SCOPE);

        expect(types).toEqual(['object', 'object', 'object']);
    });
});

// ---------------------------------------------------------------------------
// Wire.get(name, index) — selects the nth instance
// ---------------------------------------------------------------------------

test.describe('Wire.get() with index', () => {
    test('Wire.get(scope, 0) returns first proxy', async ({ page }) => {
        const name = await page.evaluate((scope) => window.Wire.get(scope, 0).user.name, CARD_SCOPE);

        expect(name).toBe('Alice');
    });

    test('Wire.get(scope, 1) returns second proxy', async ({ page }) => {
        const name = await page.evaluate((scope) => window.Wire.get(scope, 1).user.name, CARD_SCOPE);

        expect(name).toBe('Bob');
    });

    test('Wire.get(scope, 2) returns third proxy', async ({ page }) => {
        const name = await page.evaluate((scope) => window.Wire.get(scope, 2).user.name, CARD_SCOPE);

        expect(name).toBe('Carol');
    });

    test('Wire.get(scope) without index defaults to first instance', async ({ page }) => {
        const name = await page.evaluate((scope) => window.Wire.get(scope).user.name, CARD_SCOPE);

        expect(name).toBe('Alice');
    });

    test('Wire.get(scope, outOfRange) returns undefined', async ({ page }) => {
        const value = await page.evaluate((scope) => window.Wire.get(scope, 99), CARD_SCOPE);

        expect(value).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Programmatic updates — each instance is independent
// ---------------------------------------------------------------------------

test.describe('independent instance updates', () => {
    test('mutating instance 0 updates first card only', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope, 0).user.name = 'Updated0'; }, CARD_SCOPE);

        await expect(page.locator('.user-card').nth(0).locator('.card-name')).toHaveText('Updated0');
        await expect(page.locator('.user-card').nth(1).locator('.card-name')).toHaveText('Bob');
        await expect(page.locator('.user-card').nth(2).locator('.card-name')).toHaveText('Carol');
    });

    test('mutating instance 1 updates second card only', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope, 1).user.name = 'Updated1'; }, CARD_SCOPE);

        await expect(page.locator('.user-card').nth(0).locator('.card-name')).toHaveText('Alice');
        await expect(page.locator('.user-card').nth(1).locator('.card-name')).toHaveText('Updated1');
        await expect(page.locator('.user-card').nth(2).locator('.card-name')).toHaveText('Carol');
    });

    test('mutating instance 2 updates third card only', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope, 2).user.name = 'Updated2'; }, CARD_SCOPE);

        await expect(page.locator('.user-card').nth(0).locator('.card-name')).toHaveText('Alice');
        await expect(page.locator('.user-card').nth(1).locator('.card-name')).toHaveText('Bob');
        await expect(page.locator('.user-card').nth(2).locator('.card-name')).toHaveText('Updated2');
    });

    test('mutating all instances works independently', async ({ page }) => {
        await page.evaluate((scope) => {
            window.Wire.get(scope, 0).user.name = 'X';
            window.Wire.get(scope, 1).user.name = 'Y';
            window.Wire.get(scope, 2).user.name = 'Z';
        }, CARD_SCOPE);

        await expect(page.locator('.user-card').nth(0).locator('.card-name')).toHaveText('X');
        await expect(page.locator('.user-card').nth(1).locator('.card-name')).toHaveText('Y');
        await expect(page.locator('.user-card').nth(2).locator('.card-name')).toHaveText('Z');
    });

    test('mutating status attribute on instance 0 does not affect instance 1', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope, 0).user.status = 'vip'; }, CARD_SCOPE);

        await expect(page.locator('.user-card').nth(0).locator('[data-wire="user.status:class"]')).toHaveAttribute('class', 'vip');
        await expect(page.locator('.user-card').nth(1).locator('[data-wire="user.status:class"]')).toHaveAttribute('class', 'inactive');
    });
});

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

test.describe('snapshot per instance', () => {
    test('Wire.snapshot(scope) with multiple instances returns array of all scopes', async ({ page }) => {
        const all = await page.evaluate(() => window.Wire.snapshot());
        const cards = all.filter(s => s.scope === CARD_SCOPE);

        expect(cards).toHaveLength(3);
    });

    test('snapshot reflects correct data per card', async ({ page }) => {
        const all = await page.evaluate(() => window.Wire.snapshot());
        const cards = all.filter(s => s.scope === CARD_SCOPE);
        const names = cards.map(c => c.data.user.name);

        expect(names).toContain('Alice');
        expect(names).toContain('Bob');
        expect(names).toContain('Carol');
    });

    test('snapshot after mutation reflects updated value', async ({ page }) => {
        await page.evaluate((scope) => { window.Wire.get(scope, 1).user.name = 'Updated'; }, CARD_SCOPE);

        const all = await page.evaluate(() => window.Wire.snapshot());
        const cards = all.filter(s => s.scope === CARD_SCOPE);
        const names = cards.map(c => c.data.user.name);

        expect(names).toContain('Updated');
    });
});
