import { test, expect } from '@playwright/test';
import { authenticateOnly, programCard } from './helpers/seed';

test.describe('Catalog flow', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateOnly(page);
  });

  test('dashboard loads program catalog from API', async ({ page }) => {
    await page.goto('/app/programs');

    // Wait for catalog to load — should see at least one program name
    await expect(page.getByRole('heading', { name: 'GZCLP' }).first()).toBeVisible({
      timeout: 10_000,
    });

    // All 3 preset programs should be visible
    await expect(page.getByRole('heading', { name: 'HeXaN PPL' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nivel 7' })).toBeVisible();
  });

  test('user can start a GZCLP program from the catalog', async ({ page }) => {
    await page.goto('/app/programs');

    // Wait for catalog to render
    await expect(page.getByRole('heading', { name: 'GZCLP' }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Scope to the GZCLP card and click its specific "Iniciar Programa" button
    await programCard(page, 'GZCLP').getByRole('button', { name: 'Iniciar Programa' }).click();

    // After clicking, should see the GZCLP setup form heading
    await expect(page.getByText('Pesos Iniciales (kg)')).toBeVisible({ timeout: 10_000 });
  });

  test('catalog shows program metadata (author, workouts per week)', async ({ page }) => {
    await page.goto('/app/programs');

    await expect(page.getByRole('heading', { name: 'GZCLP' }).first()).toBeVisible({
      timeout: 10_000,
    });

    // Check that workout count and author info are rendered
    await expect(page.getByText('90 entrenamientos').first()).toBeVisible();
    await expect(page.getByText('Cody Lefever', { exact: false }).first()).toBeVisible();
  });

  test('search and level chips narrow the catalog and an empty result offers a reset', async ({
    page,
  }) => {
    await page.goto('/app/programs');
    await expect(page.getByTestId('featured-program')).toBeVisible({ timeout: 10_000 });
    const count = page.getByTestId('catalog-count');
    const total = Number(await count.textContent());
    expect(total).toBeGreaterThan(3);

    await page.getByRole('searchbox').fill('hexan');
    await expect(count).toHaveText('1');
    await expect(page.getByTestId('featured-program')).toHaveCount(0);

    await page.getByRole('searchbox').fill('zzzz');
    await expect(page.getByTestId('catalog-empty')).toBeVisible();
    await page.getByRole('button', { name: 'Restablecer filtros' }).click();
    await expect(count).toHaveText(String(total));
    await expect(page.getByTestId('featured-program')).toBeVisible();

    await page.getByRole('button', { name: 'Avanzado' }).click();
    await expect(page.getByTestId('featured-program')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Tenkaichi Budokai — Veterano' })).toBeVisible();
  });
});
