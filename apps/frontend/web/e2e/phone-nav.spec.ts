import { test, expect, type Page } from '@playwright/test';
import { authenticateOnly, enterGuestMode } from './helpers/seed';

test.use({ viewport: { width: 390, height: 844 } });

const tabBar = (page: Page) => page.getByTestId('mobile-bottom-nav');
const tab = (page: Page, name: string) => tabBar(page).getByRole('link', { name, exact: true });

test.describe('Phone tab bar (signed in)', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateOnly(page);
    await page.goto('/app');
    await expect(tabBar(page)).toBeVisible({ timeout: 10_000 });
  });

  test('shows the five mobile tabs in order and no hamburger', async ({ page }) => {
    const labels = await tabBar(page).getByRole('link').allInnerTexts();
    expect(labels).toEqual(['Entrenar', 'Mis planes', 'Explorar', 'Ejercicios', 'Más']);
    await expect(page.getByRole('button', { name: /abrir menú|open menu/i })).toHaveCount(0);
  });

  test('reaches Train, My plans, Explore, Exercises and More in one tap', async ({ page }) => {
    // Without an active program the tracker route hands the user back to the home overview.
    await tab(page, 'Entrenar').click();
    await page.waitForURL(/\/app\/?$/);
    await expect(tab(page, 'Entrenar')).toHaveAttribute('aria-current', 'page');

    await tab(page, 'Mis planes').click();
    await page.waitForURL('**/app/programs');
    await expect(page.getByRole('heading', { level: 1, name: 'Programas' })).toBeVisible();
    await expect(tab(page, 'Mis planes')).toHaveAttribute('aria-current', 'page');

    await tab(page, 'Explorar').click();
    await page.waitForURL('**/app/explore');
    await expect(page.getByRole('heading', { level: 1, name: 'Explorar' })).toBeVisible();
    await expect(page.getByText('GZCLP').first()).toBeVisible({ timeout: 10_000 });

    await tab(page, 'Ejercicios').click();
    await page.waitForURL('**/app/exercises');
    await expect(tab(page, 'Ejercicios')).toHaveAttribute('aria-current', 'page');

    await tab(page, 'Más').click();
    await page.waitForURL('**/app/profile');
    await expect(page.getByRole('heading', { level: 1, name: 'Perfil' })).toBeVisible();
    await expect(tab(page, 'Más')).toHaveAttribute('aria-current', 'page');
  });

  test('reaches Home and Insights from More in two taps', async ({ page }) => {
    await tab(page, 'Más').click();
    await page.getByRole('link', { name: /Análisis/ }).click();
    await page.waitForURL('**/app/insights');
    await expect(tab(page, 'Más')).toHaveAttribute('aria-current', 'page');

    await tab(page, 'Más').click();
    await page.getByRole('link', { name: /Inicio/ }).click();
    await page.waitForURL(/\/app$/);
  });

  test('keeps language, theme and sign out on More', async ({ page }) => {
    await tab(page, 'Más').click();
    await expect(page.getByRole('radiogroup', { name: /idioma|language/i })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: /tema|theme/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();

    await page.getByRole('radio', { name: 'English' }).click();
    await expect(tab(page, 'More')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  test('signs out from More', async ({ page }) => {
    await tab(page, 'Más').click();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await page.waitForURL('**/login', { timeout: 10_000 });
  });

  test('sends My plans to Explore for a new program', async ({ page }) => {
    await tab(page, 'Mis planes').click();
    await page.getByTestId('programs-explore-link').click();
    await page.waitForURL('**/app/explore');
  });

  test('has no horizontal overflow and the page clears the bar', async ({ page }) => {
    for (const name of ['Entrenar', 'Mis planes', 'Explorar', 'Ejercicios', 'Más']) {
      await tab(page, name).click();
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflow, `${name} overflows horizontally`).toBe(false);
    }
  });
});

test.describe('Phone tab bar (guest)', () => {
  test('offers the same tabs and a guest More with account creation', async ({ page }) => {
    await enterGuestMode(page);
    await expect(tabBar(page)).toBeVisible();
    expect(await tabBar(page).getByRole('link').allInnerTexts()).toEqual([
      'Entrenar',
      'Mis planes',
      'Explorar',
      'Ejercicios',
      'Más',
    ]);

    await tab(page, 'Más').click();
    await page.waitForURL('**/app/profile');
    await expect(page.getByRole('radiogroup', { name: /tema|theme/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Análisis/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Crear cuenta' }).last()).toBeVisible();
  });
});

test.describe('Phone tab bar and floating chrome', () => {
  test('the cookie notice sits above the bar', async ({ page }) => {
    await authenticateOnly(page);
    await page.addInitScript(() => window.localStorage.removeItem('cookie-banner-dismissed'));
    await page.goto('/app');
    const banner = page.locator('[data-cookie-banner] > div');
    await expect(banner).toBeVisible({ timeout: 10_000 });
    const bar = await tabBar(page).boundingBox();
    const notice = await banner.boundingBox();
    expect(bar).not.toBeNull();
    expect(notice).not.toBeNull();
    if (bar && notice) expect(notice.y + notice.height).toBeLessThanOrEqual(bar.y + 1);
  });
});
