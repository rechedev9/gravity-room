import { test, expect } from '@playwright/test';
import {
  seedProgram,
  navigateToTracker,
  dismissRpeIfPresent,
  ensureCompactView,
  tierUndoButton,
  markTierSuccess,
} from './helpers/seed';

/**
 * Authenticated user E2E tests — covers flows that require a real
 * user session via the dev login API endpoint.
 */

/* ── Dashboard with Active Program ─────────────── */

test.describe('Authenticated dashboard', () => {
  test('shows "Empezar entrenamiento" when user has active program', async ({ page }) => {
    await seedProgram(page);
    await page.goto('/app');
    await expect(
      page.getByRole('link', { name: /continuar entrenamiento|empezar entrenamiento/i })
    ).toBeVisible({
      timeout: 10_000,
    });
  });

  test('clicking "Empezar entrenamiento" loads the tracker', async ({ page }) => {
    await seedProgram(page);
    await navigateToTracker(page);
    await expect(page.getByRole('progressbar')).toBeVisible();
  });
});

/* ── Authenticated Tracker ─────────────────────── */

test.describe('Authenticated tracker', () => {
  test.beforeEach(async ({ page }) => {
    await seedProgram(page);
    await navigateToTracker(page);
  });

  test('progress bar is visible', async ({ page }) => {
    await expect(page.getByRole('progressbar')).toBeVisible();
  });

  test('can mark T1 success and see undo enabled', async ({ page }) => {
    // Detailed (set-first) is the default view and hides the whole-slot result
    // control until a result exists; compact view exposes the hero lift's
    // per-set/fail affordances that markTierSuccess drives.
    await ensureCompactView(page);
    await markTierSuccess(page, 'T1');
    await dismissRpeIfPresent(page);
    // Undo lives on the card that recorded it — there is no chrome-level
    // "Deshacer" button anymore (session-chrome.tsx).
    await expect(tierUndoButton(page, 'T1', 'éxito')).toBeVisible();
  });

  test('profile (where stats now live) is accessible for authenticated users', async ({ page }) => {
    // The tracker's Stats tab was removed; statistics now live only on the
    // profile page, reached from the sidebar nav item that is guest-hidden
    // (see guest-mode.spec.ts REQ-GROUT-003 / REQ-GROUT-005).
    await page.getByRole('link', { name: 'Perfil' }).first().click();
    await expect(page).toHaveURL(/\/app\/profile/);
    await expect(page.getByText(/crea una cuenta/i)).not.toBeVisible({ timeout: 2_000 });
  });
});
