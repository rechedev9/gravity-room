import { test, expect } from '@playwright/test';
import { guestWithProgram } from './helpers/seed';

/**
 * Tracker interaction E2E tests — covers the core tracking UX:
 * sequential set confirmation, day navigation, view toggle, and edit weights.
 */

/* ── Sequential Set Confirmation ───────────────── */

test.describe('Sequential set confirmation', () => {
  test.beforeEach(async ({ page }) => {
    await guestWithProgram(page, 'GZCLP');
  });

  test('set 1 is enabled, sets 2-5 are disabled initially', async ({ page }) => {
    await expect(page.getByRole('spinbutton', { name: 'Reps serie 1' }).first()).toBeEnabled();
    await expect(page.getByRole('spinbutton', { name: 'Reps serie 2' }).first()).toBeDisabled();
  });

  test('confirming set 1 unlocks set 2', async ({ page }) => {
    await page.getByRole('button', { name: 'Confirmar serie 1' }).first().click();
    await expect(page.getByRole('spinbutton', { name: 'Reps serie 2' }).first()).toBeEnabled();
    await expect(page.getByRole('spinbutton', { name: 'Reps serie 3' }).first()).toBeDisabled();
  });
});

/* ── Day Navigation ────────────────────────────── */

test.describe('Day navigation', () => {
  test.beforeEach(async ({ page }) => {
    await guestWithProgram(page, 'GZCLP');
  });

  test('prev button is disabled on day 1', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Día anterior' })).toBeDisabled();
  });

  test('next button navigates to day 2', async ({ page }) => {
    await page.getByRole('button', { name: 'Siguiente día' }).click();
    await expect(page.getByText(/^Día 2$/).first()).toBeVisible();
  });

  test('can navigate forward and back', async ({ page }) => {
    await page.getByRole('button', { name: 'Siguiente día' }).click();
    await expect(page.getByText(/^Día 2$/).first()).toBeVisible();

    await page.getByRole('button', { name: 'Día anterior' }).click();
    await expect(page.getByText(/^Día 1$/).first()).toBeVisible();
  });
});

/* ── View Toggle ───────────────────────────────── */

test.describe('View toggle', () => {
  test.beforeEach(async ({ page }) => {
    await guestWithProgram(page, 'GZCLP');
  });

  test('can switch to compact view and back', async ({ page }) => {
    const compactBtn = page.getByRole('button', { name: 'Cambiar a vista compacta' });
    await expect(compactBtn).toBeVisible();
    await compactBtn.click();

    const detailedBtn = page.getByRole('button', { name: 'Cambiar a vista detallada' });
    await expect(detailedBtn).toBeVisible();
    await detailedBtn.click();

    await expect(compactBtn).toBeVisible();
  });
});

/* ── Edit Weights ──────────────────────────────── */

test.describe('Edit weights', () => {
  test.beforeEach(async ({ page }) => {
    await guestWithProgram(page, 'GZCLP');
  });

  test('"Editar Pesos" opens modal with "Actualizar Pesos" button', async ({ page }) => {
    await page.getByRole('button', { name: 'Editar Pesos' }).click();
    await expect(page.getByRole('button', { name: 'Actualizar Pesos' })).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible();
  });

  test('cancelling edit returns to tracker', async ({ page }) => {
    await page.getByRole('button', { name: 'Editar Pesos' }).click();
    await expect(page.getByRole('button', { name: 'Actualizar Pesos' })).toBeVisible({
      timeout: 5_000,
    });
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText(/^Día \d+$/).first()).toBeVisible({ timeout: 5_000 });
  });
});

/* ── Overflow Menu ─────────────────────────────── */

test.describe('Overflow menu', () => {
  test.beforeEach(async ({ page }) => {
    await guestWithProgram(page, 'GZCLP');
  });

  test('menu opens and shows all actions', async ({ page }) => {
    await page.getByRole('button', { name: 'Más acciones' }).click();
    await expect(page.getByRole('menuitem', { name: 'Exportar CSV' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Finalizar Programa' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Reiniciar Todo' })).toBeVisible();
  });

  test('menu closes on Escape', async ({ page }) => {
    await page.getByRole('button', { name: 'Más acciones' }).click();
    await expect(page.getByRole('menuitem', { name: 'Exportar CSV' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem', { name: 'Exportar CSV' })).not.toBeVisible();
  });
});
