import { test, expect } from '@playwright/test';
import { seedProgram, navigateToTracker } from './helpers/seed';

test.describe('Undo', () => {
  test.beforeEach(async ({ page }) => {
    await seedProgram(page);
    await navigateToTracker(page);
  });

  test('undo button disabled when no history', async ({ page }) => {
    // The toolbar undo button is the first "Deshacer" button on the page
    const undoBtn = page.getByRole('button', { name: 'Deshacer', exact: true }).first();
    await expect(undoBtn).toBeDisabled();
  });

  test('record T1 then undo via toolbar', async ({ page }) => {
    const undoBtn = page.getByRole('button', { name: 'Deshacer', exact: true }).first();

    // Record T1 success — GZCLP Day 1 T1 slot is d1-t1
    await page.getByRole('button', { name: 'Marcar d1-t1 éxito' }).first().click();
    await expect(page.getByRole('button', { name: 'Deshacer d1-t1 éxito' }).first()).toBeVisible();

    // Undo via toolbar button
    await expect(undoBtn).toBeEnabled();
    await undoBtn.click();

    // Pass/fail buttons should reappear
    await expect(page.getByRole('button', { name: 'Marcar d1-t1 éxito' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Marcar d1-t1 fallo' }).first()).toBeVisible();
    await expect(undoBtn).toBeDisabled();
  });

  test('record T1 then undo via badge click', async ({ page }) => {
    // Record T1 success
    await page.getByRole('button', { name: 'Marcar d1-t1 éxito' }).first().click();
    const badge = page.getByRole('button', { name: 'Deshacer d1-t1 éxito' }).first();
    await expect(badge).toBeVisible();

    // Click badge to undo (badge is a button)
    await badge.click();

    // Pass/fail buttons should reappear
    await expect(page.getByRole('button', { name: 'Marcar d1-t1 éxito' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Marcar d1-t1 fallo' }).first()).toBeVisible();
  });

  test('undo count text updates', async ({ page }) => {
    // No undo count shown initially
    await expect(page.getByText('1x')).not.toBeVisible();

    // Record T1 success
    await page.getByRole('button', { name: 'Marcar d1-t1 éxito' }).first().click();
    await expect(page.getByText('1x')).toBeVisible();
  });
});
