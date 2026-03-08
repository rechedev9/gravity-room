import { test, expect } from '@playwright/test';
import { seedProgram } from './helpers/seed';

/**
 * Authenticated user E2E tests — covers flows that require a real
 * user session via the dev login API endpoint.
 */

/** Local navigateToTracker that handles the "Día" strict mode issue. */
async function goToTracker(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/app');
  const continueBtn = page.getByRole('button', { name: 'Continuar Entrenamiento' });
  await expect(continueBtn).toBeVisible({ timeout: 10_000 });
  await continueBtn.click();
  await expect(page.getByText(/^Día \d+$/).first()).toBeVisible({ timeout: 10_000 });
}

/* ── Dashboard with Active Program ─────────────── */

test.describe('Authenticated dashboard', () => {
  test('shows "Continuar Entrenamiento" when user has active program', async ({ page }) => {
    await seedProgram(page);
    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Continuar Entrenamiento' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('clicking "Continuar Entrenamiento" loads the tracker', async ({ page }) => {
    await seedProgram(page);
    await goToTracker(page);
    await expect(page.getByRole('progressbar')).toBeVisible();
  });
});

/* ── Authenticated Tracker ─────────────────────── */

test.describe('Authenticated tracker', () => {
  test.beforeEach(async ({ page }) => {
    await seedProgram(page);
    await goToTracker(page);
  });

  test('progress bar is visible', async ({ page }) => {
    await expect(page.getByRole('progressbar')).toBeVisible();
  });

  test('can mark T1 success and see undo enabled', async ({ page }) => {
    await page.getByRole('button', { name: 'Marcar d1-t1 éxito' }).click();
    // Dismiss RPE dialog if it appears
    const rpeBtn = page.getByRole('button', { name: /continuar sin rpe/i });
    if (await rpeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await rpeBtn.click();
    }
    await expect(page.getByRole('button', { name: 'Deshacer' }).first()).toBeEnabled();
  });

  test('stats tab is accessible for authenticated users', async ({ page }) => {
    await page.getByRole('tab', { name: /estad/i }).click();
    await expect(page.getByText(/crea una cuenta/i)).not.toBeVisible({ timeout: 2_000 });
  });
});
