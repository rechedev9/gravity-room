import { test, expect } from '@playwright/test';
import { authenticateOnly, programCard } from './helpers/seed';

test.describe('Catalog flow', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateOnly(page);
  });

  test('dashboard loads program catalog from API', async ({ page }) => {
    await page.goto('/app/programs');

    // Wait for catalog to load — should see at least one program name
    await expect(page.getByText('GZCLP')).toBeVisible({ timeout: 10_000 });

    // All 3 preset programs should be visible
    await expect(page.getByText('HeXaN PPL', { exact: true })).toBeVisible();
    await expect(page.getByText('Nivel 7')).toBeVisible();
  });

  test('user can start a GZCLP program from the catalog', async ({ page }) => {
    await page.goto('/app/programs');

    // Wait for catalog to render
    await expect(page.getByText('GZCLP')).toBeVisible({ timeout: 10_000 });

    // Scope to the GZCLP card and use its compact fast-start action.
    await programCard(page, 'GZCLP').getByRole('button', { name: 'Iniciar directamente' }).click();

    // After clicking, should see the GZCLP setup form heading
    await expect(page.getByText('Pesos Iniciales (kg)')).toBeVisible({ timeout: 10_000 });
  });

  test('catalog shows program metadata (author, workouts per week)', async ({ page }) => {
    await page.goto('/app/programs');

    await expect(page.getByText('GZCLP')).toBeVisible({ timeout: 10_000 });

    // Check that the comparable session metric and author info are rendered.
    const gzclpCard = programCard(page, 'GZCLP');
    await expect(gzclpCard.getByText('90', { exact: true })).toBeVisible();
    await expect(gzclpCard.getByText('sesiones', { exact: true })).toBeVisible();
    await expect(gzclpCard.getByText('Gravity Room', { exact: false })).toBeVisible();
  });
});
