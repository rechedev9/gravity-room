import { test, expect } from '@playwright/test';
import { seedProgram } from './helpers/seed';

test.describe('Weight unit preference', () => {
  test('lbs chosen on the profile applies on home and tracker and survives a reload', async ({
    page,
  }) => {
    await seedProgram(page, {
      results: { '0': { t1: 'success', t2: 'success', t3: 'success' } },
    });
    await page.goto('/app/profile');
    await page
      .getByRole('button', { name: /libras|lbs/i })
      .first()
      .click();

    await page.goto('/app');
    const main = page.locator('main');
    await expect(main).toContainText(/\d+(\.\d+)? lbs/);
    await expect(main).not.toContainText(/\d+(\.\d+)? kg/);

    await page.goto('/app/tracker/gzclp');
    await expect(page.getByTestId('session-chrome')).toBeVisible();
    await expect(page.locator('main')).toContainText(/\blbs\b/i);
    await expect(page.getByRole('columnheader', { name: /^kg$/i })).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId('session-chrome')).toBeVisible();
    await expect(page.locator('main')).toContainText(/\blbs\b/i);
  });
});

test.describe('Phone navigation and guided start', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('exercises and More are one tap from the bottom bar and insights two', async ({ page }) => {
    await seedProgram(page);
    await page.goto('/app');
    const nav = page.getByTestId('mobile-bottom-nav');
    await nav.getByRole('link', { name: /ejercicios|exercises/i }).click();
    await expect(page).toHaveURL(/\/app\/exercises$/);
    await nav.getByRole('link', { name: /^(más|more)$/i }).click();
    await expect(page).toHaveURL(/\/app\/profile$/);
    await page.getByRole('link', { name: /análisis|insights/i }).click();
    await expect(page).toHaveURL(/\/app\/insights$/);
  });

  test('moving to the next guided step returns to the top of the page', async ({ page }) => {
    await seedProgram(page);
    await page.goto('/app/start');
    await page.getByTestId('start-program-card').first().click();
    const next = page.getByTestId('start-program-continue');
    await next.scrollIntoViewIfNeeded();
    await next.click();
    await expect(page.getByTestId('start-weight-value')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });
});
