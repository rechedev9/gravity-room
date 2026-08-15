import { test, expect } from '@playwright/test';
import {
  seedProgram,
  navigateToTracker,
  ensureCompactView,
  tierOutcomeButton,
  tierUndoButton,
} from './helpers/seed';

test.describe('Undo', () => {
  test.beforeEach(async ({ page }) => {
    await seedProgram(page);
    await navigateToTracker(page);
    await ensureCompactView(page);
  });

  test('undo has no chrome surface — it lives on the card that recorded it', async ({ page }) => {
    await expect(page.getByTestId('session-chrome')).toBeVisible();
    await expect(page.getByTestId('session-chrome').getByText(/deshacer/i)).toHaveCount(0);
  });

  test('record T1 then undo via keyboard', async ({ page }) => {
    await tierOutcomeButton(page, 'T1', 'éxito').click();
    await expect(tierUndoButton(page, 'T1', 'éxito')).toBeVisible();

    await page.keyboard.press('u');

    // Pass/fail buttons should reappear
    await expect(tierOutcomeButton(page, 'T1', 'éxito')).toBeVisible();
    await expect(tierOutcomeButton(page, 'T1', 'fallo')).toBeVisible();
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

  test('recording a result offers undo on the completed card', async ({ page }) => {
    await tierOutcomeButton(page, 'T1', 'éxito').click();

    const completed = page.getByTestId('completed-slot-row').first();
    await expect(completed).toBeVisible();
    await expect(completed.getByTestId('result-cell-undo')).toBeVisible();
  });
});
