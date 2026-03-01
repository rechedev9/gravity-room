import { test, expect } from '@playwright/test';
import { createAndAuthUser } from './helpers/api';

const BASE_URL = process.env['E2E_API_URL'] ?? 'http://localhost:3001';

test.describe('Auth flow', () => {
  test('navigates to /login and shows Google sign-in button', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Gravity Room' })).toBeVisible();
    await expect(page.getByText('Autenticar')).toBeVisible();
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
