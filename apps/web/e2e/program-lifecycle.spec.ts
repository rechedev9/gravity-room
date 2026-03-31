import { test, expect, type Page } from '@playwright/test';
import { enterGuestMode, programCard, dismissCookieBannerIfPresent } from './helpers/seed';

/**
 * Program lifecycle E2E tests — verifies the critical flows that broke
 * after the guest mode / catalog card changes (commit da6e765).
 *
 * All tests run in guest mode (no API auth needed).
 */

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
  await dismissCookieBannerIfPresent(page);
  await page.getByRole('navigation').first().getByRole('link', { name: 'Inicio' }).click();
  await expect(page.getByText('Elegir un Programa')).toBeVisible({ timeout: 10_000 });
}

/* ── Tests ──────────────────────────────────────── */

test.describe('Program Lifecycle — Guest Mode', () => {
  test.beforeEach(async ({ page }) => {
    await enterGuestMode(page);
  });

  test('start program → view tracker → back to catalog', async ({ page }) => {
    await startProgram(page, 'GZCLP');

    await expect(page.getByText('T1', { exact: true })).toBeVisible();
    await expect(page.getByRole('progressbar')).toBeVisible();

    await backToCatalog(page);

    await expect(
      programCard(page, 'GZCLP').getByRole('button', { name: 'Iniciar Programa' })
    ).toBeVisible();
  });

  test('start program → reset all → start different program', async ({ page }) => {
    await startProgram(page, 'GZCLP');

    await page.getByRole('button', { name: 'Más acciones' }).click();
    await page.getByRole('menuitem', { name: 'Reiniciar Todo' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Reiniciar Todo' }).click();

    await backToCatalog(page);

    await startProgram(page, '5/3/1 for Beginners');
    await expect(page.getByRole('progressbar')).toBeVisible();
  });

  test('start program → finalize → start new program', async ({ page }) => {
    await startProgram(page, 'GZCLP');

    await page.getByRole('button', { name: 'Más acciones' }).click();
    await page.getByRole('menuitem', { name: 'Finalizar Programa' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Finalizar' }).click();

    await backToCatalog(page);

    await programCard(page, 'GZCLP').getByRole('button', { name: 'Iniciar Programa' }).click();
    await expect(page.getByRole('button', { name: 'Generar Programa' })).toBeVisible({
      timeout: 10_000,
    });
  });
});
