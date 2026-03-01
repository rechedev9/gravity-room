import { test, expect } from '@playwright/test';
import { seedProgram, navigateToTracker } from './helpers/seed';
import { buildSuccessResults } from './helpers/fixtures';

test.describe('Stats panel', () => {
  test('shows empty state when no results', async ({ page }) => {
    // seedProgram with no results — program exists so navigateToTracker works,
    // but stats panel has no recorded data (empty state).
    await seedProgram(page);
    await navigateToTracker(page);
    // Wait for the Stats & Charts tab to appear (tracker loaded)
    await expect(page.getByRole('tab', { name: 'Estadísticas' })).toBeVisible();

    // Switch to Stats tab
    await page.getByRole('tab', { name: 'Estadísticas' }).click();

    await expect(page.getByText('Sin datos aún')).toBeVisible();
  });

  test('shows summary cards with exercise names', async ({ page }) => {
    await seedProgram(page, { results: buildSuccessResults(4) });
    await navigateToTracker(page);
    await expect(page.getByRole('progressbar').last()).toBeVisible();

    // Switch to Stats tab
    await page.getByRole('tab', { name: 'Estadísticas' }).click();

    // Summary card headings should show T1 exercise names in Spanish
    await expect(page.getByRole('heading', { name: 'Sentadilla', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Press Banca', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Peso Muerto', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Press Militar', exact: true })).toBeVisible();
  });

  test('summary cards display weight in kg', async ({ page }) => {
    await seedProgram(page, { results: buildSuccessResults(4) });
    await navigateToTracker(page);
    await expect(page.getByRole('progressbar').last()).toBeVisible();

    await page.getByRole('tab', { name: 'Estadísticas' }).click();

    // Scope to the stats tabpanel to avoid matching hidden program-tab content
    await expect(page.locator('#panel-stats').getByText(/kg/).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('renders chart canvas elements', async ({ page }) => {
    await seedProgram(page, { results: buildSuccessResults(4) });
    await navigateToTracker(page);
    await expect(page.getByRole('progressbar').last()).toBeVisible();

    await page.getByRole('tab', { name: 'Estadísticas' }).click();

    // Charts use canvas elements for rendering
    const canvases = page.locator('canvas');
    await expect(canvases.first()).toBeVisible();
  });
});
