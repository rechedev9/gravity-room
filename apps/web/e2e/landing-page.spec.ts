import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders hero section', async ({ page }) => {
    await expect(page.getByText('Entrena Mejor.')).toBeVisible();
    await expect(page.getByText('Progresa Más Rápido.')).toBeVisible();
  });

  test('displays CTA links', async ({ page }) => {
    const startLink = page.getByRole('link', { name: /Comenzar/ }).first();
    await expect(startLink).toBeVisible();
    await expect(startLink).toHaveAttribute('href', '/login');

    const signInLink = page.getByRole('link', { name: 'Iniciar Sesión →' }).first();
    await expect(signInLink).toBeVisible();
    await expect(signInLink).toHaveAttribute('href', '/login');
  });

  test('Start Training navigates to /login', async ({ page }) => {
    await page
      .getByRole('link', { name: /Comenzar/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/login/);
  });
});
