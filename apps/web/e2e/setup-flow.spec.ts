import { test, expect } from '@playwright/test';
import { authenticateOnly, navigateToGzclpSetup, navigateToTracker } from './helpers/seed';

test.describe('Setup flow', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateOnly(page);
    await navigateToGzclpSetup(page);
  });

  test('renders setup form with correct defaults', async ({ page }) => {
    await expect(page.getByText('Pesos Iniciales (kg)')).toBeVisible();

    // GZCLP weight fields default to the field minimum (2.5 kg) when no initialConfig
    await expect(page.locator('#weight-squat')).toHaveValue('2.5');
    await expect(page.locator('#weight-bench')).toHaveValue('2.5');
    await expect(page.locator('#weight-deadlift')).toHaveValue('2.5');
    await expect(page.locator('#weight-ohp')).toHaveValue('2.5');
    await expect(page.locator('#weight-latpulldown')).toHaveValue('2.5');
    await expect(page.locator('#weight-dbrow')).toHaveValue('2.5');
  });

  test('+/- buttons adjust weight by 0.5', async ({ page }) => {
    // GZCLP step is 2.5 kg; starting from default min of 2.5
    const squatInput = page.locator('#weight-squat');
    await expect(squatInput).toHaveValue('2.5');

    await page.getByRole('button', { name: 'Aumentar Sentadilla' }).click();
    await expect(squatInput).toHaveValue('5');

    await page.getByRole('button', { name: 'Disminuir Sentadilla' }).click();
    await expect(squatInput).toHaveValue('2.5');
  });

  test('shows validation error for weight below minimum', async ({ page }) => {
    const squatInput = page.locator('#weight-squat');
    await squatInput.fill('1');
    await squatInput.blur();

    await expect(page.getByRole('alert').filter({ hasText: 'Mín 2.5 kg' })).toBeVisible();
  });

  test('Generate Program creates program and shows Semana 1', async ({ page }) => {
    await page.getByRole('button', { name: 'Generar Programa' }).click();

    await expect(page.getByText('Semana 1', { exact: true })).toBeVisible();
    await expect(page.getByRole('progressbar').last()).toBeVisible();
  });

  test('program is persisted after setup', async ({ page }) => {
    await page.getByRole('button', { name: 'Generar Programa' }).click();
    await expect(page.getByText('Semana 1', { exact: true })).toBeVisible();

    // Reload — must navigate back to tracker (reload resets URL to dashboard)
    await page.reload();
    await page.waitForLoadState('networkidle'); // wait for auth/refresh to complete
    await navigateToTracker(page);
    await expect(page.getByText('Semana 1', { exact: true })).toBeVisible();
  });
});
