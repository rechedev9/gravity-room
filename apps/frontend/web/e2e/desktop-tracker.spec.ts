import { test, expect } from '@playwright/test';
import { navigateToTracker, seedProgram } from './helpers/seed';

/**
 * lg+ tracker (artboard S8, decision L3): the table is the only layout, the
 * whole-slot quick actions still work next to the per-set rows, and the fixed
 * key bar is on screen.
 */
test.describe('Desktop tracker', () => {
  test.beforeEach(async ({ page }) => {
    await seedProgram(page);
    await navigateToTracker(page);
  });

  test('renders the set table, the slot actions and the key bar', async ({ page }) => {
    await expect(page.getByTestId('slot-set-table').first()).toBeVisible();
    await expect(page.getByTestId('session-key-bar')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /marcar .+ \(T1\) como éxito/i }).first()
    ).toBeVisible();
  });

  test('a whole-slot success is recorded and can be undone', async ({ page }) => {
    await page
      .getByRole('button', { name: /marcar .+ \(T1\) como éxito/i })
      .first()
      .click();

    await expect(
      page.getByRole('button', { name: /deshacer .+ \(T1\) éxito/i }).first()
    ).toBeVisible();
  });

  test('the compact/detailed toggle is not offered at lg+', async ({ page }) => {
    await page.getByRole('button', { name: /cambiar día/i }).click();
    await expect(page.getByRole('button', { name: /vista compacta/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /vista detallada/i })).toHaveCount(0);
  });
});
