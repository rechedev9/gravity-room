import { test, expect } from '@playwright/test';
import { authenticateOnly } from './helpers/seed';

test.describe('Catalog flow', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateOnly(page);
  });

  test('dashboard loads program catalog from API', async ({ page }) => {
    await page.goto('/app');

    // Wait for catalog to load — should see at least one program name
    await expect(page.getByText('GZCLP')).toBeVisible({ timeout: 10_000 });

    // All 3 preset programs should be visible
    await expect(page.getByText('HeXaN PPL', { exact: true })).toBeVisible();
    await expect(page.getByText('Nivel 7')).toBeVisible();
  });

  test('user can start a GZCLP program from the catalog', async ({ page }) => {
    await page.goto('/app');

    // Wait for catalog to render
    await expect(page.getByText('GZCLP')).toBeVisible({ timeout: 10_000 });

    // Scope to the GZCLP card and click its specific "Iniciar Programa" button
    const gzclpCard = page.locator('.card').filter({
      has: page.getByRole('heading', { name: 'GZCLP', level: 3 }),
    });
    await gzclpCard.getByRole('button', { name: 'Iniciar Programa' }).click();

    // After clicking, should see the GZCLP setup form heading
    await expect(page.getByText('Pesos Iniciales (kg)')).toBeVisible({ timeout: 10_000 });
  });

  test('catalog shows program metadata (author, workouts per week)', async ({ page }) => {
    await page.goto('/app');

    await expect(page.getByText('GZCLP')).toBeVisible({ timeout: 10_000 });

    // Check that workout count and author info are rendered
    await expect(page.getByText('90 entrenamientos').first()).toBeVisible();
    await expect(page.getByText('Cody Lefever', { exact: false })).toBeVisible();
  });
});
