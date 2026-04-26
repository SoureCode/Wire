import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('/wire-test/multi-fixture');
});

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

test.describe('per-card scope access', () => {
    test('three wire-scope start markers exist (one per card)', async ({ page }) => {
        const count = await page.evaluate(() => {
            const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
            let node, n = 0;
            while ((node = walker.nextNode())) {
                if (node.textContent.trim().startsWith('wire-scope:')) n++;
            }
            return n;
        });
        expect(count).toBe(3);
    });

    test('first card scope returns Alice', async ({ page }) => {
        const name = await page.evaluate(() => {
            const card = document.querySelectorAll('.user-card')[0];
            return window.Wire.getScope(card).get('user').name;
        });
        expect(name).toBe('Alice');
    });

    test('second card scope returns Bob', async ({ page }) => {
        const name = await page.evaluate(() => {
            const card = document.querySelectorAll('.user-card')[1];
            return window.Wire.getScope(card).get('user').name;
        });
        expect(name).toBe('Bob');
    });

    test('third card scope returns Carol', async ({ page }) => {
        const name = await page.evaluate(() => {
            const card = document.querySelectorAll('.user-card')[2];
            return window.Wire.getScope(card).get('user').name;
        });
        expect(name).toBe('Carol');
    });
});

test.describe('independent instance updates', () => {
    test('mutating card 0 updates first card only', async ({ page }) => {
        await page.evaluate(() => {
            window.Wire.getScope(document.querySelectorAll('.user-card')[0]).get('user').name = 'Updated0';
        });
        await expect(page.locator('.user-card').nth(0).locator('.card-name')).toHaveText('Updated0');
        await expect(page.locator('.user-card').nth(1).locator('.card-name')).toHaveText('Bob');
        await expect(page.locator('.user-card').nth(2).locator('.card-name')).toHaveText('Carol');
    });

    test('mutating card 1 updates second card only', async ({ page }) => {
        await page.evaluate(() => {
            window.Wire.getScope(document.querySelectorAll('.user-card')[1]).get('user').name = 'Updated1';
        });
        await expect(page.locator('.user-card').nth(0).locator('.card-name')).toHaveText('Alice');
        await expect(page.locator('.user-card').nth(1).locator('.card-name')).toHaveText('Updated1');
        await expect(page.locator('.user-card').nth(2).locator('.card-name')).toHaveText('Carol');
    });

    test('mutating card 2 updates third card only', async ({ page }) => {
        await page.evaluate(() => {
            window.Wire.getScope(document.querySelectorAll('.user-card')[2]).get('user').name = 'Updated2';
        });
        await expect(page.locator('.user-card').nth(0).locator('.card-name')).toHaveText('Alice');
        await expect(page.locator('.user-card').nth(1).locator('.card-name')).toHaveText('Bob');
        await expect(page.locator('.user-card').nth(2).locator('.card-name')).toHaveText('Updated2');
    });

    test('mutating all cards works independently', async ({ page }) => {
        await page.evaluate(() => {
            const cards = document.querySelectorAll('.user-card');
            window.Wire.getScope(cards[0]).get('user').name = 'X';
            window.Wire.getScope(cards[1]).get('user').name = 'Y';
            window.Wire.getScope(cards[2]).get('user').name = 'Z';
        });
        await expect(page.locator('.user-card').nth(0).locator('.card-name')).toHaveText('X');
        await expect(page.locator('.user-card').nth(1).locator('.card-name')).toHaveText('Y');
        await expect(page.locator('.user-card').nth(2).locator('.card-name')).toHaveText('Z');
    });

    test('mutating status on card 0 does not affect card 1', async ({ page }) => {
        await page.evaluate(() => {
            window.Wire.getScope(document.querySelectorAll('.user-card')[0]).get('user').status = 'vip';
        });
        await expect(page.locator('.user-card').nth(0).locator('[data-wire="user.status:class"]')).toHaveAttribute('class', 'vip');
        await expect(page.locator('.user-card').nth(1).locator('[data-wire="user.status:class"]')).toHaveAttribute('class', 'inactive');
    });
});

test.describe('snapshot per card', () => {
    test('each card snapshot reflects its own data', async ({ page }) => {
        const names = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.user-card')).map(card =>
                window.Wire.getScope(card).snapshot().user.name
            );
        });
        expect(names).toEqual(['Alice', 'Bob', 'Carol']);
    });

    test('snapshot after mutation reflects updated value', async ({ page }) => {
        await page.evaluate(() => {
            window.Wire.getScope(document.querySelectorAll('.user-card')[1]).get('user').name = 'Updated';
        });
        const name = await page.evaluate(() => {
            return window.Wire.getScope(document.querySelectorAll('.user-card')[1]).snapshot().user.name;
        });
        expect(name).toBe('Updated');
    });
});
