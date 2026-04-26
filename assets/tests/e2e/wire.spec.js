import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('/wire-test/fixture');
});

test('text bindings render initial values', async ({ page }) => {
    await expect(page.locator('main h1, body > h1, h1')).toHaveText('Jason');
    await expect(page.locator('main p, body > p, p')).toHaveText('jason@example.com');
});

test('attribute binding sets class from data', async ({ page }) => {
    await expect(page.locator('span').first()).toHaveAttribute('class', 'active');
});

test('typing in input updates the bound text element', async ({ page }) => {
    const input = page.locator('input').first();
    const heading = page.locator('h1').first();

    await input.fill('');
    await input.type('New Name');

    await expect(heading).toHaveText('New Name');
});

test('Wire exposes a global init function', async ({ page }) => {
    const hasWire = await page.evaluate(() => typeof window.Wire !== 'undefined' && typeof window.Wire.init === 'function');

    expect(hasWire).toBe(true);
});
