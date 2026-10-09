import { test, expect, type Page } from '@playwright/test';
import { expectSelectedDay, seedProgram } from './helpers/seed';

type View = 'detailed' | 'compact';

async function openTrackerIn(page: Page, view: View): Promise<void> {
  await seedProgram(page);
  await page.addInitScript((mode: string) => {
    window.localStorage.setItem('view-preference', mode);
  }, view);
  await page.goto('/app/tracker/gzclp');
  await expectSelectedDay(page, 1);
}

/** Confirms sets in whatever control the view offers until the day closes. */
async function confirmEverySet(page: Page, view: View): Promise<void> {
  const panel = page.getByTestId('day-completed-panel');
  const confirm =
    view === 'detailed'
      ? page.locator('button[aria-label^="Confirmar serie"]:not([disabled])').first()
      : page.getByTestId('current-lift-confirm-set');
  for (let i = 0; i < 40 && !(await panel.isVisible()); i++) {
    // The compact rest timer keeps the hero card animating, which stalls the
    // actionability check; the click itself is what is under test.
    await confirm.dispatchEvent('click', undefined, { timeout: 2_000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
}

for (const view of ['detailed', 'compact'] as const) {
  test.describe(`Finishing a workout (${view} view)`, () => {
    test('closes the day with its stats and continues to the next workout', async ({ page }) => {
      await openTrackerIn(page, view);
      await expect(page.getByTestId('day-completed-panel')).toHaveCount(0);

      await confirmEverySet(page, view);

      const panel = page.getByTestId('day-completed-panel');
      await expect(panel).toBeVisible();
      await expect(panel).toContainText('Día 1 completado');
      await expect(panel.getByTestId('day-completed-line')).toHaveCount(3);
      await expect(panel.getByRole('term').filter({ hasText: 'Volumen' })).toBeVisible();
      // Day 1 stays selected until the lifter chooses to move on.
      await expectSelectedDay(page, 1);

      await panel.getByTestId('day-completed-next').click();

      await expectSelectedDay(page, 2);
      await expect(page.getByTestId('day-completed-panel')).toHaveCount(0);
    });

    test('a day that is not finished shows no completion screen', async ({ page }) => {
      await openTrackerIn(page, view);

      const first =
        view === 'detailed'
          ? page.getByRole('button', { name: 'Confirmar serie 1' }).first()
          : page.getByTestId('current-lift-confirm-set');
      await first.dispatchEvent('click');

      await expect(page.getByTestId('day-completed-panel')).toHaveCount(0);
    });
  });
}
