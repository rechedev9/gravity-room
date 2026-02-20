import { test, expect } from '@playwright/test';
import { createAndAuthUser } from './helpers/api';

test.describe('Auth flow', () => {
  test('navigates to /login and shows Google sign-in button', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText('Welcome')).toBeVisible();
    await expect(page.getByText('Continue without an account')).toBeVisible();
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
});
