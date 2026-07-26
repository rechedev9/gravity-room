import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders hero section', async ({ page }) => {
    const hero = page.getByRole('region', {
      name: /Entra\. Entrena\.\s*Sal más fuerte\./i,
    });
    await expect(hero).toBeVisible();
    await expect(
      hero.getByRole('heading', {
        name: /Entra\. Entrena\.\s*Sal más fuerte\./i,
        level: 1,
      })
    ).toBeVisible();
  });

  test('displays CTA links', async ({ page }) => {
    const startLink = page.getByRole('link', { name: /Crear mi plan gratis/ }).first();
    await expect(startLink).toBeVisible();
    await expect(startLink).toHaveAttribute('href', '/login');

    const signInLink = page.getByRole('link', { name: 'Iniciar Sesión →' }).first();
    await expect(signInLink).toBeVisible();
    await expect(signInLink).toHaveAttribute('href', '/login');
  });

  test('Start Training navigates to /login', async ({ page }) => {
    await page
      .getByRole('link', { name: /Crear mi plan gratis/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('guest CTA enters guest mode and lands on /app/programs', async ({ page }) => {
    await page.getByRole('button', { name: 'Probar sin cuenta', exact: true }).first().click();

    await expect(page).toHaveURL(/\/app\/programs/);
    // We are in guest mode: the catalog page has no guest banner (it only
    // renders on home/tracker), so assert the sidebar's guest-only CTA instead.
    await expect(page.getByRole('button', { name: /crear cuenta/i })).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe('security.txt', () => {
  test('GET /.well-known/security.txt returns plain-text RFC 9116 document', async ({ page }) => {
    const res = await page.request.get('/.well-known/security.txt');

    expect(res.status()).toBe(200);

    const contentType = res.headers()['content-type'] ?? '';
    expect(contentType.startsWith('text/plain')).toBe(true);

    const body = await res.text();
    expect(body.startsWith('<!DOCTYPE')).toBe(false);

    expect(body).toContain('Contact: https://github.com/rechedev9/gravity-room/issues');
    expect(body).toContain('Expires: 2027-03-01T00:00:00Z');
  });
});
