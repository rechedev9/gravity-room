import { test, expect } from '@playwright/test';
import { authenticateOnly, dismissCookieBannerIfPresent, programCard } from './helpers/seed';

/**
 * Catalog → preview → tracker flow (SPEC.md acceptance criterion 8).
 *
 * Authenticated path: /app/programs prioritizes exploration and keeps a compact
 * direct-start action. Exploration routes to the public preview; the preview's
 * "Iniciar Programa" CTA routes to /app/tracker/:id.
 */

test.describe('Programs catalog — preview action', () => {
  test('catalog exploration → preview page → start tracker', async ({ page }) => {
    await authenticateOnly(page);
    await page.goto('/app/programs');

    await expect(page.getByRole('heading', { name: 'GZCLP', level: 3 })).toBeVisible({
      timeout: 10_000,
    });

    await programCard(page, 'GZCLP')
      .getByRole('link', { name: /ver programa gzclp/i })
      .click();

    await expect(page).toHaveURL(/\/programs\/gzclp$/);
    await expect(page.getByRole('heading', { name: 'GZCLP' })).toBeVisible({ timeout: 10_000 });

    await dismissCookieBannerIfPresent(page);

    await page.getByRole('link', { name: 'Iniciar Programa' }).last().click();

    await expect(page).toHaveURL(/\/app\/tracker\/gzclp/);
  });

  test('catalog direct-start fast path still works alongside exploration', async ({ page }) => {
    await authenticateOnly(page);
    await page.goto('/app/programs');

    await expect(page.getByRole('heading', { name: 'GZCLP', level: 3 })).toBeVisible({
      timeout: 10_000,
    });

    const card = programCard(page, 'GZCLP');
    await expect(card.getByRole('link', { name: /ver programa gzclp/i })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Iniciar directamente' })).toBeVisible();

    await card.getByRole('button', { name: 'Iniciar directamente' }).click();

    await expect(page).toHaveURL(/\/app\/tracker\/gzclp/);
  });
});
