import { test, expect, type Page } from '@playwright/test';
import { programCard } from './helpers/seed';

/**
 * Program lifecycle E2E tests — verifies the critical flows that broke
 * after the guest mode / catalog card changes (commit da6e765).
 *
 * All tests run in guest mode (no API auth needed).
 */

/* ── Helpers ────────────────────────────────────── */

async function enterGuestMode(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Probar sin cuenta' }).click();
  await page.waitForURL('**/app**', { timeout: 10_000 });
  await expect(page.getByText('Elegir un Programa')).toBeVisible({ timeout: 10_000 });
}

/** Start any program — uses "Generar Programa" button as a universal setup gate. */
async function startProgram(page: Page, name: string): Promise<void> {
  await programCard(page, name).getByRole('button', { name: 'Iniciar Programa' }).click();
  await expect(page.getByRole('button', { name: 'Generar Programa' })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole('button', { name: 'Generar Programa' }).click();
  await expect(page.getByText(/^Día \d+$/).first()).toBeVisible({ timeout: 10_000 });
}

async function backToCatalog(page: Page): Promise<void> {
  await page.getByRole('button', { name: /programas/i }).click();
  await expect(page.getByText('Elegir un Programa')).toBeVisible({ timeout: 10_000 });
}

/* ── Tests ──────────────────────────────────────── */

test.describe('Program Lifecycle — Guest Mode', () => {
  test.beforeEach(async ({ page }) => {
    await enterGuestMode(page);
  });

  test('start program → view tracker → back to catalog', async ({ page }) => {
    await startProgram(page, 'GZCLP');

    // Verify tracker rendered
    await expect(page.getByText('T1', { exact: true })).toBeVisible();
    await expect(page.getByRole('progressbar')).toBeVisible();

    // Back to catalog
    await backToCatalog(page);

    // Catalog cards are still interactive
    await expect(
      programCard(page, 'GZCLP').getByRole('button', { name: 'Iniciar Programa' })
    ).toBeVisible();
  });

  test('start program → reset all → start different program', async ({ page }) => {
    await startProgram(page, 'GZCLP');

    // Open overflow menu → reset
    await page.getByRole('button', { name: 'Más acciones' }).click();
    await page.getByRole('menuitem', { name: 'Reiniciar Todo' }).click();

    // Confirm the danger dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Reiniciar Todo' }).click();

    // After reset: back to setup form. Navigate to catalog.
    await backToCatalog(page);

    // Start a different program
    await startProgram(page, '5/3/1 for Beginners');
    await expect(page.getByRole('progressbar')).toBeVisible();
  });

  test('start program → finalize → start new program', async ({ page }) => {
    await startProgram(page, 'GZCLP');

    // Finalize from menu
    await page.getByRole('button', { name: 'Más acciones' }).click();
    await page.getByRole('menuitem', { name: 'Finalizar Programa' }).click();

    // Confirm finalization
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Finalizar' }).click();

    // Guest mode: goes to setup form (no completion screen). Navigate to catalog.
    await backToCatalog(page);

    // Can start the same program again
    await programCard(page, 'GZCLP').getByRole('button', { name: 'Iniciar Programa' }).click();
    await expect(page.getByRole('button', { name: 'Generar Programa' })).toBeVisible({
      timeout: 10_000,
    });
  });
});
