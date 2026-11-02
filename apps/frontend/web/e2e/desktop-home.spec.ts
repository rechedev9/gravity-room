import { test, expect } from '@playwright/test';
import { seedProgram } from './helpers/seed';

const RESULTS = {
  '0': { t1: 'success', t2: 'success', t3: 'success' },
  '1': { t1: 'success', t2: 'success', t3: 'success' },
  '2': { t1: 'success', t2: 'success', t3: 'success' },
  '3': { t1: 'fail', t2: 'success', t3: 'success' },
};

/**
 * Home at lg+ (artboard 01): the desktop layout owns the page, its start button
 * reaches the tracker, and below lg the phone dashboard is still the one shown.
 */
test.describe('Desktop Home', () => {
  test.beforeEach(async ({ page }) => {
    await seedProgram(page, { results: RESULTS });
    await page.goto('/app');
  });

  test('lays out today, the week, the loads, the milestone and the program', async ({ page }) => {
    await expect(page.getByTestId('desktop-home-greeting')).toBeVisible();
    await expect(page.getByRole('heading', { name: /sesión de hoy/i })).toBeVisible();
    await expect(page.getByText('T1', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /esta semana/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /cargas t1/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /próximo hito/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /última sesión/i })).toBeVisible();
    await page.getByTestId('desktop-home-greeting').scrollIntoViewIfNeeded();
    await expect(page.getByRole('heading', { name: /^programa$/i })).toBeVisible();
  });

  test('the start button opens the tracker', async ({ page }) => {
    await page.getByRole('link', { name: /empezar sesión/i }).click();
    await expect(page).toHaveURL(/\/app\/tracker/);
    await expect(page.getByTestId('session-chrome')).toBeVisible();
  });

  test('below lg the phone dashboard is still the one rendered', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app');
    await expect(page.getByTestId('desktop-home-greeting')).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: /empezar entrenamiento|continuar entrenamiento/i })
    ).toBeVisible();
  });
});
