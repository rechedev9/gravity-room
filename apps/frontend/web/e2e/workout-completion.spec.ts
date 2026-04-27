import { test, expect } from '@playwright/test';
import { guestWithProgram, dismissRpeIfPresent } from './helpers/seed';

/**
 * Workout completion E2E tests — covers full day completion,
 * progress tracking, and multi-day progression.
 */

/** Mark all 3 GZCLP day 1 tiers and dismiss any resulting dialogs. */
async function completeDay1(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'Marcar d1-t1 éxito' }).click();
  await dismissRpeIfPresent(page);

  await page.getByRole('button', { name: 'Marcar d1-t2 éxito' }).click();
  await dismissRpeIfPresent(page);

  await page.getByRole('button', { name: 'Marcar latpulldown-t3 éxito' }).click();
  await dismissRpeIfPresent(page);
}

/* ── Full Day Completion ───────────────────────── */

test.describe('Full day completion', () => {
  test.beforeEach(async ({ page }) => {
    await guestWithProgram(page, 'GZCLP');
  });

  test('marking all 3 tiers enables undo (results recorded)', async ({ page }) => {
    await completeDay1(page);
    await expect(page.getByRole('button', { name: 'Deshacer' }).first()).toBeEnabled();
  });

  test('completing day 1 then navigating to day 2 shows new exercises', async ({ page }) => {
    await completeDay1(page);

    await page.getByRole('button', { name: 'Siguiente día' }).click();
    await expect(page.getByText(/^Día 2$/).first()).toBeVisible();

    await expect(page.getByRole('button', { name: 'Marcar d2-t1 éxito' })).toBeVisible();
  });

  test('marking T1 as failure enables undo', async ({ page }) => {
    await page.getByRole('button', { name: 'Marcar d1-t1 fallo' }).click();
    await expect(page.getByRole('button', { name: 'Deshacer' }).first()).toBeEnabled();
  });
});

/* ── Undo Flow ─────────────────────────────────── */

test.describe('Undo after marking', () => {
  test.beforeEach(async ({ page }) => {
    await guestWithProgram(page, 'GZCLP');
  });

  test('undo button is disabled with no history', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Deshacer' }).first()).toBeDisabled();
  });

  test('marking then undoing restores pass/fail buttons', async ({ page }) => {
    await page.getByRole('button', { name: 'Marcar d1-t1 fallo' }).click();

    const undoBtn = page.getByRole('button', { name: 'Deshacer' }).first();
    await expect(undoBtn).toBeEnabled();
    await undoBtn.click();

    await expect(page.getByRole('button', { name: 'Marcar d1-t1 éxito' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Marcar d1-t1 fallo' })).toBeVisible();
  });
});
