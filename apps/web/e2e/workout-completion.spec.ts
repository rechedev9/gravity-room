import { test, expect, type Page } from '@playwright/test';
import { programCard } from './helpers/seed';

/**
 * Workout completion E2E tests — covers full day completion,
 * progress tracking, and multi-day progression.
 */

/* ── Helpers ────────────────────────────────────── */

async function guestWithGzclp(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Probar sin cuenta' }).click();
  await page.waitForURL('**/app**', { timeout: 10_000 });
  await expect(page.getByText('Elegir un Programa')).toBeVisible({ timeout: 10_000 });
  await programCard(page, 'GZCLP').getByRole('button', { name: 'Iniciar Programa' }).click();
  await expect(page.getByRole('button', { name: 'Generar Programa' })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole('button', { name: 'Generar Programa' }).click();
  await expect(page.getByText(/^Día \d+$/).first()).toBeVisible({ timeout: 10_000 });
}

/** Dismiss RPE dialog if present — must be called BEFORE any navigation. */
async function dismissRpeIfPresent(page: Page): Promise<void> {
  const rpeBtn = page.getByRole('button', { name: /continuar sin rpe/i });
  if (await rpeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await rpeBtn.click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });
  }
}

/** Mark all 3 GZCLP day 1 tiers and dismiss any resulting dialogs. */
async function completeDay1(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Marcar d1-t1 éxito' }).click();
  await dismissRpeIfPresent(page);

  await page.getByRole('button', { name: 'Marcar d1-t2 éxito' }).click();
  await dismissRpeIfPresent(page);

  await page.getByRole('button', { name: 'Marcar latpulldown-t3 éxito' }).click();
  await dismissRpeIfPresent(page);
}

/* ── Full Day Completion ───────────────────────── */

test.describe('Full day completion', () => {
  test.beforeEach(async ({ page }) => {
    await guestWithGzclp(page);
  });

  test('marking all 3 tiers enables undo (results recorded)', async ({ page }) => {
    await completeDay1(page);
    // Undo is enabled = results were recorded
    await expect(page.getByRole('button', { name: 'Deshacer' }).first()).toBeEnabled();
  });

  test('completing day 1 then navigating to day 2 shows new exercises', async ({ page }) => {
    await completeDay1(page);

    // Navigate to day 2
    await page.getByRole('button', { name: 'Siguiente día' }).click();
    await expect(page.getByText(/^Día 2$/).first()).toBeVisible();

    // Day 2 has different exercises
    await expect(page.getByRole('button', { name: 'Marcar d2-t1 éxito' })).toBeVisible();
  });

  test('marking T1 as failure enables undo', async ({ page }) => {
    await page.getByRole('button', { name: 'Marcar d1-t1 fallo' }).click();
    await expect(page.getByRole('button', { name: 'Deshacer' }).first()).toBeEnabled();
  });
});

/* ── Undo Flow ─────────────────────────────────── */

test.describe('Undo after marking', () => {
  test.beforeEach(async ({ page }) => {
    await guestWithGzclp(page);
  });

  test('undo button is disabled with no history', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Deshacer' }).first()).toBeDisabled();
  });

  test('marking then undoing restores pass/fail buttons', async ({ page }) => {
    await page.getByRole('button', { name: 'Marcar d1-t1 fallo' }).click();

    const undoBtn = page.getByRole('button', { name: 'Deshacer' }).first();
    await expect(undoBtn).toBeEnabled();
    await undoBtn.click();

    await expect(page.getByRole('button', { name: 'Marcar d1-t1 éxito' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Marcar d1-t1 fallo' })).toBeVisible();
  });
});
