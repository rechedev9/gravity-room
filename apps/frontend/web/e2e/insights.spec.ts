import { test, expect } from '@playwright/test';
import { authenticateOnly } from './helpers/seed';

test.describe('Insights view', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateOnly(page);
  });

  test('sidebar exposes the Insights nav item', async ({ page }) => {
    await page.goto('/app');
    const nav = page.getByRole('navigation').first();
    await expect(nav.getByRole('link', { name: 'Análisis' })).toBeVisible({ timeout: 10_000 });
  });

  test('navigating to /app/insights renders the page header', async ({ page }) => {
    await page.goto('/app/insights');
    await expect(page.getByRole('heading', { name: 'Análisis' })).toBeVisible({ timeout: 10_000 });
  });

  test('shows the empty state when no insights are computed', async ({ page }) => {
    await page.goto('/app/insights');
    await expect(page.getByText('Sin análisis todavía')).toBeVisible({ timeout: 10_000 });
  });
});
