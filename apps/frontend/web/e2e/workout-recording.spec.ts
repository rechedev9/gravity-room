import { test, expect } from '@playwright/test';
import { seedProgram, navigateToTracker } from './helpers/seed';

test.describe('Workout recording', () => {
  test.beforeEach(async ({ page }) => {
    await seedProgram(page);
    await navigateToTracker(page);
  });

  test('pass/fail buttons visible for workout #1', async ({ page }) => {
    // GZCLP Day 1 slots: d1-t1 (Sentadilla T1), d1-t2 (Press Banca T2)
    await expect(page.getByRole('button', { name: 'Marcar d1-t1 éxito' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Marcar d1-t1 fallo' }).first()).toBeVisible();
  });

  test('T1 success shows toast and badge', async ({ page }) => {
    await page.getByRole('button', { name: 'Marcar d1-t1 éxito' }).first().click();

    // Toast should appear with success message
    await expect(page.getByText('#1: Sentadilla T1 — Éxito')).toBeVisible();

    // Badge ✓ should appear as an undo button
    await expect(page.getByRole('button', { name: 'Deshacer d1-t1 éxito' }).first()).toBeVisible();
  });

  test('T1 success reveals AMRAP input', async ({ page }) => {
    await page.getByRole('button', { name: 'Marcar d1-t1 éxito' }).first().click();

    // AMRAP input group should now be visible (role="group" aria-label="Reps AMRAP")
    await expect(page.getByRole('group', { name: 'Reps AMRAP' }).first()).toBeVisible();
  });

  test('T2 fail shows toast and badge', async ({ page }) => {
    await page.getByRole('button', { name: 'Marcar d1-t2 fallo' }).first().click();

    // Toast should appear with fail message
    await expect(page.getByText('#1: Press Banca T2 — Fallo')).toBeVisible();

    // Badge ✗ should appear as an undo button
    await expect(page.getByRole('button', { name: 'Deshacer d1-t2 fallo' }).first()).toBeVisible();
  });
});
