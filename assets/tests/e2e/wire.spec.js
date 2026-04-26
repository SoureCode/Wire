import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('/wire-test/fixture');
});

test('text bindings render initial values', async ({ page }) => {
    await expect(page.locator('h1[data-wire]')).toHaveText('Jason');
    await expect(page.locator('p[data-wire]')).toHaveText('jason@example.com');
});

test('attribute binding sets class from data', async ({ page }) => {
    await expect(page.locator('span[data-wire]')).toHaveAttribute('class', 'active');
});

test('typing in input updates the bound text element', async ({ page }) => {
    const input = page.locator('input[data-wire]');
    const heading = page.locator('h1[data-wire]');

    await input.fill('');
    await input.type('New Name');

    await expect(heading).toHaveText('New Name');
});

test('Wire exposes a global init function', async ({ page }) => {
    const hasWire = await page.evaluate(() => typeof window.Wire !== 'undefined' && typeof window.Wire.init === 'function');

    expect(hasWire).toBe(true);
});
