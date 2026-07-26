import { test, expect } from '@playwright/test';
import { seedProgram, navigateToTracker, tierOutcomeButton, tierUndoButton } from './helpers/seed';

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

    await tierOutcomeButton(page, 'T1', 'éxito').click();
    await expect(tierUndoButton(page, 'T1', 'éxito')).toBeVisible();

    // Undo via toolbar button
    await expect(undoBtn).toBeEnabled();
    await undoBtn.click();

    // Pass/fail buttons should reappear
    await expect(tierOutcomeButton(page, 'T1', 'éxito')).toBeVisible();
    await expect(tierOutcomeButton(page, 'T1', 'fallo')).toBeVisible();
    await expect(undoBtn).toBeDisabled();
  });

  test('record T1 then undo via badge click', async ({ page }) => {
    // Record T1 success
    await tierOutcomeButton(page, 'T1', 'éxito').click();
    const badge = tierUndoButton(page, 'T1', 'éxito');
    await expect(badge).toBeVisible();

    // Click badge to undo (badge is a button)
    await badge.click();

    // Pass/fail buttons should reappear
    await expect(tierOutcomeButton(page, 'T1', 'éxito')).toBeVisible();
    await expect(tierOutcomeButton(page, 'T1', 'fallo')).toBeVisible();
  });

  test('undo count text updates', async ({ page }) => {
    // No undo count shown initially
    await expect(page.getByText('1x')).not.toBeVisible();

    // Record T1 success
    await tierOutcomeButton(page, 'T1', 'éxito').click();
    await expect(page.getByText('1x')).toBeVisible();
  });
});
