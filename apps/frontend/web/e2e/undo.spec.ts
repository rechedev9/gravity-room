import { test, expect } from '@playwright/test';
import {
  seedProgram,
  navigateToTracker,
  ensureCompactView,
  tierUndoButton,
  markTierSuccess,
} from './helpers/seed';

test.describe('Undo', () => {
  test.beforeEach(async ({ page }) => {
    await seedProgram(page);
    await navigateToTracker(page);
    await ensureCompactView(page);
  });

  test('header undo is disabled with no history and reverts the last result', async ({ page }) => {
    const undo = page.getByTestId('session-chrome-undo');
    await expect(undo).toBeDisabled();

    await markTierSuccess(page, 'T1');
    await expect(tierUndoButton(page, 'T1', 'éxito')).toBeVisible();
    await expect(undo).toBeEnabled();
    await undo.click();

    // T1 is unresolved again, so it is back as the hero lift.
    const heroCard = page.getByTestId('current-lift-card');
    await expect(heroCard.getByTestId('current-lift-confirm-set')).toBeVisible();
    await expect(tierUndoButton(page, 'T1', 'éxito')).toHaveCount(0);
    await expect(undo).toBeDisabled();
  });

  test('record T1 then undo via keyboard', async ({ page }) => {
    await markTierSuccess(page, 'T1');
    await expect(tierUndoButton(page, 'T1', 'éxito')).toBeVisible();

    await page.keyboard.press('u');

    // Pass/fail affordance should reappear. T1 becomes the hero lift again
    // (current-lift-card.tsx), so the per-set confirm/fail controls are what
    // come back — there is no whole-slot ✓/✗ for the hero.
    const heroCard = page.getByTestId('current-lift-card');
    await expect(heroCard.getByTestId('current-lift-confirm-set')).toBeVisible();
    await expect(heroCard.getByTestId('current-lift-fail')).toBeVisible();
  });

  test('record T1 then undo via badge click', async ({ page }) => {
    // Record T1 success
    await markTierSuccess(page, 'T1');
    const badge = tierUndoButton(page, 'T1', 'éxito');
    await expect(badge).toBeVisible();

    // Click badge to undo (badge is a button)
    await badge.click();

    // Pass/fail affordance should reappear on the (once again hero) T1 lift.
    const heroCard = page.getByTestId('current-lift-card');
    await expect(heroCard.getByTestId('current-lift-confirm-set')).toBeVisible();
    await expect(heroCard.getByTestId('current-lift-fail')).toBeVisible();
  });

  test('recording a result offers undo on the completed card', async ({ page }) => {
    await markTierSuccess(page, 'T1');

    const completed = page.getByTestId('completed-slot-row').first();
    await expect(completed).toBeVisible();
    await expect(completed.getByTestId('result-cell-undo')).toBeVisible();
  });
});
