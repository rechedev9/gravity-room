import { test, expect, type Locator, type Page } from '@playwright/test';
import { createAndAuthUser, createProgramById } from './helpers/api';
import { expectSelectedDay, seedProgram } from './helpers/seed';

type View = 'detailed' | 'compact';

async function openTracker(page: Page, view: View, programId: string): Promise<void> {
  await page.addInitScript((mode: string) => {
    window.localStorage.setItem('view-preference', mode);
  }, view);
  await page.goto(`/app/tracker/${programId}`);
  await expectSelectedDay(page, 1);
}

async function seedSheiko(page: Page): Promise<void> {
  const { accessToken } = await createAndAuthUser(page);
  await createProgramById(page, {
    accessToken,
    programId: 'tenkaichi-budokai-sentadilla',
    config: { squat1rm: 200, bench1rm: 140, deadlift1rm: 220, rounding: 2.5 },
  });
}

async function confirmSet(table: Locator, label: string): Promise<void> {
  // The rest timer animates the page after each set, which stalls the actionability check.
  await table
    .getByRole('button', { name: `Confirmar serie ${label}`, exact: true })
    .dispatchEvent('click');
}

test.describe('Percent-prescription ladder (Sheiko)', () => {
  test('detailed view keeps the heavy sets open until the whole ladder is logged', async ({
    page,
  }) => {
    await seedSheiko(page);
    await openTracker(page, 'detailed', 'tenkaichi-budokai-sentadilla');

    // Day 1 opens with the squat ladder: 3 warm-up groups and 4 working sets.
    const squat = page.getByTestId('slot-set-table').first();
    for (const label of ['W1', 'W2', 'W3']) await confirmSet(squat, label);

    await expect(squat.locator('[data-set-state="met"]')).toHaveCount(3);
    for (const label of ['1', '2', '3', '4']) {
      await expect(
        squat.getByRole('button', { name: `Confirmar serie ${label}`, exact: true })
      ).toBeVisible();
    }
    await expect(
      squat.getByRole('button', { name: 'Confirmar serie 1', exact: true })
    ).toBeEnabled();

    for (const label of ['1', '2', '3', '4']) await confirmSet(squat, label);

    await expect(squat.locator('[data-set-state="met"]')).toHaveCount(7);
    await expect(squat.getByRole('button', { name: /^Confirmar serie/ })).toHaveCount(0);

    await page.reload();
    await expectSelectedDay(page, 1);
    await expect(
      page.getByTestId('slot-set-table').first().locator('[data-set-state]')
    ).toHaveCount(7);
    await expect(
      page.getByTestId('slot-set-table').first().locator('[data-set-state="met"]')
    ).toHaveCount(7);
  });

  test('compact view completes a ladder lift from the result footer', async ({ page }) => {
    await seedSheiko(page);
    await openTracker(page, 'compact', 'tenkaichi-budokai-sentadilla');

    const hero = page.getByTestId('current-lift-card');
    await expect(hero.getByTestId('current-lift-confirm-set')).toHaveCount(0);
    await hero.getByRole('button', { name: /^Marcar .* como éxito$/ }).click();

    // The squat resolves and the hero moves on to the next lift.
    await expect(page.getByText('1 de 5 ejercicios')).toBeVisible();
    await expect(hero.getByRole('heading', { name: 'Press Banca' })).toBeVisible();
  });
});

test.describe('Compact AMRAP set', () => {
  test('logs the reps the lifter entered, not the target', async ({ page }) => {
    await seedProgram(page);
    await openTracker(page, 'compact', 'gzclp');

    const hero = page.getByTestId('current-lift-card');
    const confirm = hero.getByTestId('current-lift-confirm-set');
    // GZCLP T1 is 5x3+: four plain sets, then the AMRAP set.
    for (let i = 0; i < 4; i++) await confirm.dispatchEvent('click');

    const stepper = hero.getByRole('group', { name: 'Reps serie 5 de 5 (AMRAP)' });
    await expect(stepper).toBeVisible();
    for (let i = 0; i < 4; i++) {
      await stepper.getByRole('button', { name: 'Aumentar reps' }).click();
    }
    await confirm.dispatchEvent('click');

    // The lift resolves with the AMRAP reps in its log, and the hero moves on.
    await expect(page.getByText('Reps 3 · 3 · 3 · 3 · 7')).toBeVisible();
    await expect(page.getByText('1 de 3 ejercicios')).toBeVisible();
  });
});
