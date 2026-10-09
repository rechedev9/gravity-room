import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { resolvePlaywrightApiUrl } from '../playwright-ports';
import { createAndAuthUser, createVerifiedPasswordUser, skipFirstRunOverlays } from './helpers/api';
import { enterGuestMode } from './helpers/seed';

const API_URL = resolvePlaywrightApiUrl(process.env);

// Every route under the guarded app shell, plus an unknown one that still renders the shell.
const APP_ROUTES = [
  '/app',
  '/app/start',
  '/app/programs',
  '/app/tracker',
  '/app/tracker/gzclp',
  '/app/insights',
  '/app/profile',
  '/app/exercises',
  '/app/exercises/versus',
  '/app/exercises/squat',
  '/app/dashboard',
  '/app/does-not-exist',
] as const;

async function expectRedirectedToLogin(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await page.waitForURL('**/login', { timeout: 10_000 });
  await expect(page.getByRole('heading', { name: 'Gravity Room' })).toBeVisible();
}

/** Revokes the refresh token server side but keeps the now-dead cookie in the browser. */
async function expireSession(context: BrowserContext): Promise<void> {
  const staleCookies = await context.cookies();
  expect(staleCookies.length).toBeGreaterThan(0);
  const res = await context.request.post(`${API_URL}/api/auth/signout`);
  expect(res.ok()).toBe(true);
  await context.clearCookies();
  await context.addCookies(staleCookies);
}

test.describe('App route guard on a cold load', () => {
  test('never signed in: every /app route redirects to /login', async ({ page }) => {
    await skipFirstRunOverlays(page);
    for (const route of APP_ROUTES) {
      await expectRedirectedToLogin(page, route);
    }
  });

  test('expired or revoked session: every /app route redirects to /login', async ({
    page,
    context,
  }) => {
    await createAndAuthUser(page);
    await expireSession(context);
    for (const route of APP_ROUTES) {
      await expectRedirectedToLogin(page, route);
    }
  });

  test('just signed out: every /app route redirects to /login', async ({ page }) => {
    await createAndAuthUser(page);
    await page.goto('/app');
    await page.getByRole('button', { name: /menú de usuario|user menu/i }).click();
    await page.getByRole('menuitem', { name: /cerrar sesión|sign out/i }).click();
    await page.waitForURL('**/login', { timeout: 10_000 });

    for (const route of APP_ROUTES) {
      await expectRedirectedToLogin(page, route);
    }
  });

  test('a session that expires while the app is open sends the user to /login', async ({
    page,
    context,
  }) => {
    await createAndAuthUser(page);
    await page.goto('/app/programs');
    await expect(page.getByRole('button', { name: /menú de usuario|user menu/i })).toBeVisible();

    await expireSession(context);
    await page.evaluate(() => window.dispatchEvent(new Event('gravity-room:session-invalidated')));

    await page.waitForURL('**/login', { timeout: 10_000 });
  });

  test('a valid session is not bounced to /login on reload', async ({ page }) => {
    await createAndAuthUser(page);
    for (const route of ['/app', '/app/programs', '/app/profile', '/app/insights'] as const) {
      await page.goto(route);
      await expect(page.getByRole('button', { name: /menú de usuario|user menu/i })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('button', { name: /menú de usuario|user menu/i })).toBeVisible();
      expect(new URL(page.url()).pathname).toBe(route);
    }
  });

  test('signing in after anonymous page views keeps the session across a reload', async ({
    page,
  }) => {
    const email = `guard-${crypto.randomUUID()}@test.local`;
    const password = `Valid-${crypto.randomUUID()}-12345678`;
    await createVerifiedPasswordUser(page, { email, password });
    // Anonymous views first, so the signed-out hint is already stored.
    await page.goto('/privacy');
    await page.goto('/login');
    await page.getByRole('button', { name: /correo|email/i }).click();
    await page.getByLabel(/correo|email/i).fill(email);
    await page.getByLabel(/contraseña|password/i).fill(password);
    await page.getByRole('button', { name: /entrar|sign in/i }).click();
    await page.waitForURL('**/app**', { timeout: 10_000 });

    await page.goto('/app/profile');
    await expect(page.getByRole('button', { name: /menú de usuario|user menu/i })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/app/profile');
  });

  test('guest mode still opens the app shell and survives a reload', async ({ page }) => {
    await enterGuestMode(page);
    for (const route of ['/app', '/app/programs', '/app/profile', '/app/insights'] as const) {
      await page.goto(route);
      // The sidebar offers account creation only to guests; signed-in users get a user menu.
      await expect(
        page.getByRole('button', { name: /crear cuenta|create account/i }).first()
      ).toBeVisible();
      expect(new URL(page.url()).pathname).toBe(route);
    }
  });
});

test.describe('Anonymous console noise', () => {
  test('public pages stop calling /auth/refresh after the first signed-out answer', async ({
    page,
  }) => {
    await skipFirstRunOverlays(page);
    const refreshStatuses: number[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/api/auth/refresh')) refreshStatuses.push(response.status());
    });

    await page.goto('/');
    await expect.poll(() => refreshStatuses).toEqual([401]);

    for (const route of ['/login', '/privacy', '/cookies', '/programas', '/en/programs']) {
      await page.goto(route);
      await expect(page.locator('h1, h2').first()).toBeVisible();
      // Give a stray refresh time to fire before asserting that none did.
      await page.waitForTimeout(500);
    }
    expect(refreshStatuses).toEqual([401]);
  });
});
