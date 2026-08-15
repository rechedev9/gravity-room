import { test, expect } from '@playwright/test';
import {
  guestWithProgram,
  dismissRpeIfPresent,
  expandDayControls,
  ensureCompactView,
  expectSelectedDay,
  tierOutcomeButton,
  markTierSuccess,
  markTierFail,
} from './helpers/seed';

/**
 * Workout completion E2E tests — covers full day completion,
 * progress tracking, and multi-day progression.
 */

/** Mark all 3 GZCLP day 1 tiers and dismiss any resulting dialogs. */
async function completeDay1(page: import('@playwright/test').Page): Promise<void> {
  await markTierSuccess(page, 'T1');
  await dismissRpeIfPresent(page);

  await markTierSuccess(page, 'T2');
  await dismissRpeIfPresent(page);

  await markTierSuccess(page, 'T3');
  await dismissRpeIfPresent(page);
}

/* ── Full Day Completion ───────────────────────── */

test.describe('Full day completion', () => {
  test.beforeEach(async ({ page }) => {
    await guestWithProgram(page, 'GZCLP');
    await ensureCompactView(page);
  });

  test('marking all 3 tiers enables undo (results recorded)', async ({ page }) => {
    await completeDay1(page);
    // Undo now lives per-card (session-chrome carries no undo control) — the
    // day's first completed slot row surfaces the undo badge.
    const completed = page.getByTestId('completed-slot-row').first();
    await expect(completed).toBeVisible();
    await expect(completed.getByTestId('result-cell-undo')).toBeEnabled();
  });

  test('completing day 1 then navigating to day 2 shows new exercises', async ({ page }) => {
    await completeDay1(page);

    await expandDayControls(page);
    await page.getByRole('button', { name: 'Siguiente día' }).click();
    await expectSelectedDay(page, 2);

    // Day 2's T1 is a fresh hero lift with no results yet.
    const heroCard = page.getByTestId('current-lift-card');
    await expect(heroCard.getByTestId('current-lift-confirm-set')).toBeVisible();
  });

  test('marking T1 as failure enables undo', async ({ page }) => {
    await markTierFail(page, 'T1');
    const completed = page.getByTestId('completed-slot-row').first();
    await expect(completed).toBeVisible();
    await expect(completed.getByTestId('result-cell-undo')).toBeEnabled();
  });
});

/* ── Undo Flow ─────────────────────────────────── */

test.describe('Undo after marking', () => {
  test.beforeEach(async ({ page }) => {
    await guestWithProgram(page, 'GZCLP');
    await ensureCompactView(page);
  });

  test('no undo affordance exists with no history', async ({ page }) => {
    // Undo no longer has a standing chrome control (enabled/disabled) — it
    // only exists once there is something to undo, so its absence here IS
    // the "disabled with no history" contract.
    await expect(page.getByRole('button', { name: 'Deshacer' })).toHaveCount(0);
  });

  test('marking then undoing restores pass/fail buttons', async ({ page }) => {
    await markTierFail(page, 'T1');

    const completed = page.getByTestId('completed-slot-row').first();
    const undoBtn = completed.getByTestId('result-cell-undo');
    await expect(undoBtn).toBeEnabled();
    await undoBtn.click();

    // T1 is unresolved again — it is promoted back to the hero lift, whose
    // primary affordances are the per-set confirm action and the fail button.
    const heroCard = page.getByTestId('current-lift-card');
    await expect(heroCard.getByTestId('current-lift-confirm-set')).toBeVisible();
    await expect(heroCard.getByTestId('current-lift-fail')).toBeVisible();
    await expect(tierOutcomeButton(page, 'T1', 'éxito')).not.toBeVisible();
  });
});
