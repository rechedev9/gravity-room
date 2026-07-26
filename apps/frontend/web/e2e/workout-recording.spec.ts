import { test, expect } from '@playwright/test';
import { seedProgram, navigateToTracker, tierOutcomeButton, tierUndoButton } from './helpers/seed';

test.describe('Workout recording', () => {
  test.beforeEach(async ({ page }) => {
    await seedProgram(page);
    await navigateToTracker(page);
  });

  test('pass/fail buttons visible for workout #1', async ({ page }) => {
    await expect(tierOutcomeButton(page, 'T1', 'éxito')).toBeVisible();
    await expect(tierOutcomeButton(page, 'T1', 'fallo')).toBeVisible();
  });

  test('T1 success shows toast and badge', async ({ page }) => {
    await tierOutcomeButton(page, 'T1', 'éxito').click();

    // Toast should appear with success message
    await expect(page.getByText('#1: Sentadilla T1 — Éxito')).toBeVisible();

    // Badge ✓ should appear as an undo button
    await expect(tierUndoButton(page, 'T1', 'éxito')).toBeVisible();
  });

  test('T1 success reveals AMRAP input', async ({ page }) => {
    await tierOutcomeButton(page, 'T1', 'éxito').click();

    // AMRAP input group should now be visible (role="group" aria-label="Reps AMRAP")
    await expect(page.getByRole('group', { name: 'Reps AMRAP' }).first()).toBeVisible();
  });

  test('T2 fail shows toast and badge', async ({ page }) => {
    await tierOutcomeButton(page, 'T2', 'fallo').click();

    // Toast should appear with fail message
    await expect(page.getByText('#1: Press Banca T2 — Fallo')).toBeVisible();

    // Badge ✗ should appear as an undo button
    await expect(tierUndoButton(page, 'T2', 'fallo')).toBeVisible();
  });
});
