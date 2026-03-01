import { test, expect } from '@playwright/test';
import { seedProgram, navigateToTracker } from './helpers/seed';
import { buildSuccessResults } from './helpers/fixtures';

test.describe('Progression rules', () => {
  test('weight increases after successful workouts', async ({ page }) => {
    // Seed 4 all-success workouts (indices 0–3, one full rotation)
    await seedProgram(page, { results: buildSuccessResults(4) });
    await navigateToTracker(page);
    await expect(page.getByText('Semana 2', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Workout #5 (index 4) is Day 1 = Squat T1
    // Squat T1 should show 65 kg (60 start + 5 increment)
    await expect(page.getByText('65 kg')).toBeVisible();
  });

  test('T1 failure advances stage without changing weight', async ({ page }) => {
    // Seed workout 0 with T1 fail (other tiers success)
    await seedProgram(page, {
      results: {
        '0': { t1: 'fail', t2: 'success', t3: 'success' },
        '1': { t1: 'success', t2: 'success', t3: 'success' },
        '2': { t1: 'success', t2: 'success', t3: 'success' },
        '3': { t1: 'success', t2: 'success', t3: 'success' },
      },
    });
    await navigateToTracker(page);
    await expect(page.getByText('Semana 2', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Workout #5 (index 4) T1 Squat: weight stays 60, stage changes to 6×2
    await expect(page.getByText('60 kg').first()).toBeVisible();
    await expect(page.getByText('6×2')).toBeVisible();
  });
});
