import { test, expect } from '@playwright/test';

const BASE_URL = process.env['E2E_API_URL'] ?? 'http://localhost:3001';

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

test.describe('security.txt', () => {
  test('GET /.well-known/security.txt returns plain-text RFC 9116 document', async ({ page }) => {
    const res = await page.request.get(`${BASE_URL}/.well-known/security.txt`);

    expect(res.status()).toBe(200);

    const contentType = res.headers()['content-type'] ?? '';
    expect(contentType.startsWith('text/plain')).toBe(true);

    const body = await res.text();
    expect(body.startsWith('<!DOCTYPE')).toBe(false);

    expect(body).toContain('Contact: https://github.com/rechedev9/gravity-room/issues');
    expect(body).toContain('Expires: 2027-03-01T00:00:00Z');
  });
});
