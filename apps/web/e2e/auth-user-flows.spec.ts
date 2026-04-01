import { test, expect } from '@playwright/test';
import { seedProgram, navigateToTracker, dismissRpeIfPresent } from './helpers/seed';

/**
 * Authenticated user E2E tests — covers flows that require a real
 * user session via the dev login API endpoint.
 */

/* ── Dashboard with Active Program ─────────────── */

test.describe('Authenticated dashboard', () => {
  test('shows "Continuar Entrenamiento" when user has active program', async ({ page }) => {
    await seedProgram(page);
    await page.goto('/app');
    await expect(page.getByRole('link', { name: 'Continuar Entrenamiento' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('clicking "Continuar Entrenamiento" loads the tracker', async ({ page }) => {
    await seedProgram(page);
    await navigateToTracker(page);
    await expect(page.getByRole('progressbar')).toBeVisible();
  });
});

/* ── Authenticated Tracker ─────────────────────── */

test.describe('Authenticated tracker', () => {
  test.beforeEach(async ({ page }) => {
    await seedProgram(page);
    await navigateToTracker(page);
  });

  test('progress bar is visible', async ({ page }) => {
    await expect(page.getByRole('progressbar')).toBeVisible();
  });

  test('can mark T1 success and see undo enabled', async ({ page }) => {
    await page.getByRole('button', { name: 'Marcar d1-t1 éxito' }).click();
    await dismissRpeIfPresent(page);
    await expect(page.getByRole('button', { name: 'Deshacer' }).first()).toBeEnabled();
  });

  test('stats tab is accessible for authenticated users', async ({ page }) => {
    await page.getByRole('tab', { name: /estad/i }).click();
    await expect(page.getByText(/crea una cuenta/i)).not.toBeVisible({ timeout: 2_000 });
  });
});
