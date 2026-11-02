import { test, expect } from '@playwright/test';
import { seedProgram } from './helpers/seed';

/**
 * ⌘K palette on the desktop shell: the click and shortcut entry points, the
 * filtered sections, the day jump (which has to survive the tracker's own day
 * selection) and Escape.
 */
test.describe('Command palette', () => {
  test.beforeEach(async ({ page }) => {
    await seedProgram(page);
    await page.goto('/app');
    // The shell (and its shortcut listener) mounts after hydration.
    await expect(page.getByRole('button', { name: /buscar o ir a/i })).toBeVisible();
  });

  test('the search field opens it and Enter follows the active section', async ({ page }) => {
    await page.getByRole('button', { name: /buscar o ir a/i }).click();
    const dialog = page.getByRole('dialog', { name: /buscar o ir a/i });
    await expect(dialog).toBeVisible();

    const input = dialog.getByRole('combobox');
    await input.fill('entre');
    await expect(dialog.getByRole('option', { name: /entrenar/i })).toBeVisible();
    await expect(dialog.getByRole('option', { name: /^hoy/i })).toHaveCount(0);

    await input.press('Enter');
    await expect(page).toHaveURL(/\/app\/tracker/);
    await expect(page.getByTestId('session-chrome')).toBeVisible();
  });

  test('Ctrl+K opens it and a typed day number jumps the tracker', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: /buscar o ir a/i });
    await expect(dialog).toBeVisible();

    const input = dialog.getByRole('combobox');
    await input.fill('34');
    await expect(dialog.getByRole('option', { name: /ir al día 34/i })).toBeVisible();
    await input.press('Enter');

    await expect(page).toHaveURL(/\/app\/tracker\?day=34/);
    await expect(page.getByTestId('session-chrome')).toContainText('Día 34');
  });

  test('Escape closes it without navigating', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: /buscar o ir a/i });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/app$/);
  });
});
