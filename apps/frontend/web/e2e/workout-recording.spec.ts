import { test, expect } from '@playwright/test';
import {
  seedProgram,
  navigateToTracker,
  ensureCompactView,
  tierOutcomeButton,
  tierUndoButton,
} from './helpers/seed';

test.describe('Workout recording', () => {
  test.beforeEach(async ({ page }) => {
    await seedProgram(page);
    await navigateToTracker(page);
    await ensureCompactView(page);
  });

  test('pass/fail buttons visible for workout #1', async ({ page }) => {
    // T1 is the current lift, promoted to the hero card (current-lift-card.tsx):
    // its affordances are per-set confirm + a whole-lift fail button, not the
    // shared whole-slot ✓/✗ (that stays for secondary, non-hero lifts).
    const heroCard = page.getByTestId('current-lift-card');
    await expect(heroCard.getByTestId('current-lift-confirm-set')).toBeVisible();
    await expect(heroCard.getByTestId('current-lift-fail')).toBeVisible();
  });

  test('T1 success shows toast and badge', async ({ page }) => {
    // The hero lift's per-set confirm flow auto-resolves the slot without a
    // toast (useSetLogging calls the raw markResult, not recordAndToast — a
    // pre-existing, unchanged codepath). The whole-slot success toast is
    // still reachable for the hero via the `S` keyboard shortcut, which
    // drives handleMarkResult -> recordAndToast (see useKeyboardShortcuts).
    await page.keyboard.press('s');

    // Toast should appear with success message
    await expect(page.getByText('#1: Sentadilla T1 — Éxito')).toBeVisible();

    // Badge ✓ should appear as an undo button
    await expect(tierUndoButton(page, 'T1', 'éxito')).toBeVisible();
  });

  test('T1 success reveals AMRAP input', async ({ page }) => {
    // showAmrap requires slot.setLogs === undefined (slot-result-footer.tsx):
    // the per-set flow's AMRAP reps ARE the last logged set, so its follow-up
    // input is redundant by design there. Use the `S` shortcut (whole-slot
    // mark, no set logs) to reach the AMRAP follow-up.
    await page.keyboard.press('s');

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
