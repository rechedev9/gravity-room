import { test, expect } from '@playwright/test';
import { createAndAuthUser, createVerifiedPasswordUser } from './helpers/api';

const BASE_URL = process.env['E2E_API_URL'] ?? 'http://localhost:3001';

test.describe('Auth flow', () => {
  test('navigates to /login and shows Google sign-in button', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Gravity Room' })).toBeVisible();
    await expect(page.getByText('Autenticar')).toBeVisible();
    // The accessible role=button comes from the GIS iframe, which only renders
    // with a real Google client ID (see CLAUDE.md: not locally testable). The
    // visible button skin is what the app controls, so assert that instead.
    await expect(
      page.getByText(/continuar con google|continue with google/i).first()
    ).toBeVisible();
  });

  test('provider availability endpoint exposes every supported login method', async ({ page }) => {
    const res = await page.request.get(`${BASE_URL}/api/auth/providers`);
    expect(res.ok()).toBe(true);

    const providers = (await res.json()) as Record<string, unknown>;
    for (const provider of ['emailPassword', 'google', 'apple', 'github', 'microsoft']) {
      expect(typeof providers[provider]).toBe('boolean');
    }
  });

  test('login page mirrors provider availability for email, Apple, GitHub, and Outlook', async ({
    page,
  }) => {
    const res = await page.request.get(`${BASE_URL}/api/auth/providers`);
    expect(res.ok()).toBe(true);
    const providers = (await res.json()) as Record<string, boolean>;

    await page.goto('/login');

    const emailButton = page.getByRole('button', { name: /correo|email/i }).first();
    await expect(emailButton).toBeVisible();
    if (providers.emailPassword) {
      await expect(emailButton).toBeEnabled();
    } else {
      await expect(emailButton).toBeDisabled();
    }

    for (const [provider, label] of [
      ['apple', /Continuar con Apple/i],
      ['github', /Continuar con GitHub/i],
      ['microsoft', /Continuar con Outlook/i],
    ] as const) {
      const button = page.getByRole('button', { name: label });
      if (providers[provider]) {
        await expect(button).toBeVisible();
        await expect(button).toBeEnabled();
      } else {
        // Unavailable providers are not rendered at all — no disabled "coming
        // soon" placeholder.
        await expect(button).toHaveCount(0);
      }
    }
  });

  test('signed-in user is redirected away from /login', async ({ page }) => {
    // Create and authenticate a user — this sets the refresh_token httpOnly cookie
    await createAndAuthUser(page);

    // Navigate to /login — the AuthProvider will restore the session from the cookie
    await page.goto('/login');

    // Should be redirected to /app because the user is already signed in
    await page.waitForURL('**/app**', { timeout: 10_000 });
    expect(page.url()).toContain('/app');
  });

  test('verified email/password user can sign in from the login form', async ({ page }) => {
    const email = `password-${crypto.randomUUID()}@test.local`;
    const password = `Valid-${crypto.randomUUID()}-12345678`;

    await createVerifiedPasswordUser(page, { email, password });
    await page.goto('/login');

    await page.getByRole('button', { name: /correo|email/i }).click();
    await page.getByLabel(/correo|email/i).fill(email);
    await page.getByLabel(/contraseña|password/i).fill(password);
    await page.getByRole('button', { name: /entrar|sign in/i }).click();

    await page.waitForURL('**/app**', { timeout: 10_000 });
    expect(page.url()).toContain('/app');
  });

  test('manual email signup shows the verification-required success state', async ({ page }) => {
    const email = `signup-${crypto.randomUUID()}@test.local`;
    const password = `Valid-${crypto.randomUUID()}-12345678`;

    await page.goto('/login');
    await page.getByRole('button', { name: /correo|email/i }).click();
    await page.getByRole('button', { name: /crear una|sign up/i }).click();
    await page.getByLabel(/correo|email/i).fill(email);
    await page.getByLabel(/contraseña|password/i).fill(password);
    await page.getByLabel(/nombre|name/i).fill('E2E Signup');
    await page.getByRole('button', { name: /crear cuenta|create account/i }).click();

    await expect(page.getByRole('alert')).toContainText(/cuenta creada|account created/i);
  });

  test('password reset request returns the generic email-sent state', async ({ page }) => {
    const email = `reset-${crypto.randomUUID()}@test.local`;

    await page.goto('/reset-password');
    await page.getByPlaceholder(/tu@ejemplo.com|you@example.com/i).fill(email);
    await page.getByRole('button', { name: /enviar enlace|send reset link/i }).click();

    await expect(
      page.getByText(/te hemos enviado un enlace|reset link has been sent/i)
    ).toBeVisible();
  });

  test('API responses include Permissions-Policy header', async ({ page }) => {
    const { accessToken } = await createAndAuthUser(page);

    const res = await page.request.get(`${BASE_URL}/health`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const permissionsPolicy = res.headers()['permissions-policy'];
    expect(permissionsPolicy).toBeDefined();
    expect(permissionsPolicy).toContain('camera=()');
    expect(permissionsPolicy).toContain('microphone=()');
    expect(permissionsPolicy).toContain('geolocation=()');
    expect(permissionsPolicy).toContain('payment=()');
    expect(permissionsPolicy).toContain('interest-cohort=()');
  });
});
