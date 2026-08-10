import { test, expect } from '@playwright/test';
import {
  seedProgram,
  navigateToTracker,
  selectWorkoutDay,
  ensureCompactView,
} from './helpers/seed';
import { buildSuccessResults } from './helpers/fixtures';

test.describe('Progression rules', () => {
  test('weight increases after successful workouts', async ({ page }) => {
    // Seed 4 all-success workouts (indices 0–3, one full rotation)
    await seedProgram(page, { results: buildSuccessResults(4) });
    await navigateToTracker(page);
    await ensureCompactView(page);
    await selectWorkoutDay(page, 5);

    // Workout #5 (index 4) is Day 1 = Squat T1 at 65 (60 start + 5)
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
    await ensureCompactView(page);
    await selectWorkoutDay(page, 5);

    // Workout #5 (index 4) T1 Squat: weight stays 60, stage advances to S2
    await expect(page.getByText('60 kg').first()).toBeVisible();
    await expect(page.getByText('S2')).toBeVisible();
  });

  test('T1 final-stage fail deloads 10% and resets stage', async ({ page }) => {
    // Three consecutive Day-1 T1 fails: stage 0→1→2 then deload at final stage.
    // Workouts 0/4/8 are Day 1; fill intervening days so the tracker can advance.
    await seedProgram(page, {
      results: {
        '0': { t1: 'fail', t2: 'success', t3: 'success' },
        '1': { t1: 'success', t2: 'success', t3: 'success' },
        '2': { t1: 'success', t2: 'success', t3: 'success' },
        '3': { t1: 'success', t2: 'success', t3: 'success' },
        '4': { t1: 'fail', t2: 'success', t3: 'success' },
        '5': { t1: 'success', t2: 'success', t3: 'success' },
        '6': { t1: 'success', t2: 'success', t3: 'success' },
        '7': { t1: 'success', t2: 'success', t3: 'success' },
        '8': { t1: 'fail', t2: 'success', t3: 'success' },
        '9': { t1: 'success', t2: 'success', t3: 'success' },
        '10': { t1: 'success', t2: 'success', t3: 'success' },
        '11': { t1: 'success', t2: 'success', t3: 'success' },
      },
    });
    await navigateToTracker(page);
    await ensureCompactView(page);
    // Workout #13 (index 12) is Day 1 after deload: 60 * 0.9 = 54 → 55, stage 0
    // (StageTag is hidden on stage 0; assert no S2/S3)
    await selectWorkoutDay(page, 13);

    await expect(page.getByText('55 kg')).toBeVisible();
    await expect(page.getByText('S2')).not.toBeVisible();
    await expect(page.getByText('S3')).not.toBeVisible();
  });

  test('T2 final-stage fail adds 15 kg and resets stage', async ({ page }) => {
    // Bench T2 starts at 40 * 0.65 = 26 → 25. Three fails → +15 → 40, stage 0.
    await seedProgram(page, {
      results: {
        '0': { t1: 'success', t2: 'fail', t3: 'success' },
        '1': { t1: 'success', t2: 'success', t3: 'success' },
        '2': { t1: 'success', t2: 'success', t3: 'success' },
        '3': { t1: 'success', t2: 'success', t3: 'success' },
        '4': { t1: 'success', t2: 'fail', t3: 'success' },
        '5': { t1: 'success', t2: 'success', t3: 'success' },
        '6': { t1: 'success', t2: 'success', t3: 'success' },
        '7': { t1: 'success', t2: 'success', t3: 'success' },
        '8': { t1: 'success', t2: 'fail', t3: 'success' },
        '9': { t1: 'success', t2: 'success', t3: 'success' },
        '10': { t1: 'success', t2: 'success', t3: 'success' },
        '11': { t1: 'success', t2: 'success', t3: 'success' },
      },
    });
    await navigateToTracker(page);
    await ensureCompactView(page);
    await selectWorkoutDay(page, 13);

    // T2 bench after reset shows 40 kg (and the deload badge from prior cycle weight drop)
    await expect(page.getByText('40 kg')).toBeVisible();
  });
});
