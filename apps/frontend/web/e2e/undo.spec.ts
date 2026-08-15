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

  test('undo has no chrome surface — it lives on the card that recorded it', async ({ page }) => {
    const chrome = page.getByTestId('session-chrome');
    await expect(chrome).toBeVisible();
    // The chrome legitimately contains "no se puede deshacer" copy inside the
    // reset ConfirmDialog, so assert on the absence of an undo CONTROL, not
    // on any free text matching /deshacer/i.
    await expect(chrome.getByRole('button', { name: 'Deshacer' })).toHaveCount(0);
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
