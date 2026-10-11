import { test, expect } from '@playwright/test';
import { seedProgram, navigateToTracker } from './helpers/seed';

test.describe('Finishing a program', () => {
  test('shows the completion summary and returns home from it', async ({ page }) => {
    await seedProgram(page, {
      results: { '0': { t1: 'success', t2: 'success', t3: 'success' } },
    });
    await navigateToTracker(page);

    await page.getByRole('button', { name: 'Más acciones' }).click();
    await page.getByRole('menuitem', { name: 'Finalizar programa' }).click();
    await page.getByRole('button', { name: 'Finalizar', exact: true }).click();

    const summary = page.getByTestId('program-completion-screen');
    await expect(summary).toBeVisible();
    await expect(summary.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(summary).toContainText('GZCLP');

    await summary.getByRole('button').last().click();
    await expect(page).toHaveURL(/\/app$/);
  });
});
