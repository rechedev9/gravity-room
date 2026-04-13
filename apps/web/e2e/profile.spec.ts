import { test, expect } from '@playwright/test';
import { authenticateOnly } from './helpers/seed';

test.describe('Profile view', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateOnly(page);
  });

  test('shows empty state when user has no active program', async ({ page }) => {
    await page.goto('/app/profile');

    // Wait for auth session to restore and profile to render
    await expect(page.getByRole('heading', { name: 'Perfil' })).toBeVisible({ timeout: 10_000 });

    // Primary empty-state indicator — display text when no program is active
    await expect(page.getByText('SIN PROGRAMA')).toBeVisible();

    // Supporting sentence confirming the full empty-state block rendered
    await expect(
      page.getByText('Inicia un programa para ver tu perfil de entrenamiento.')
    ).toBeVisible();

    // CTA button to navigate back to home
    await expect(page.getByRole('button', { name: 'Ir al Inicio' })).toBeVisible();
  });
});
