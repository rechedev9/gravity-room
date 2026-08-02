/**
 * Analytics compute orchestrator.
 *
 * For each user it takes a transactional per-user lease, reads a bounded
 * freshness-consistent history, runs all seven pipelines, and atomically
 * replaces the insight snapshot. Upserts make retries idempotent.
 */

import { logger } from '../lib/logger';
import {
  fetchAllUsers,
  fetchWorkoutRecords,
  deleteComputedInsights,
  upsertInsight,
  withInsightTransaction,
  META_INSIGHT_TYPE,
} from './queries';
import { computeVolume } from './pipelines/volume';
import { computeFrequency } from './pipelines/frequency';
import { computeE1rmPerExercise } from './pipelines/e1rm';
import { computeSummaryPerExercise } from './pipelines/summary';
import { computePlateauPerExercise } from './pipelines/plateau';
import { computeForecastPerExercise } from './pipelines/forecast';
import { computeRecommendationPerExercise } from './pipelines/recommendation';

export interface RunAllSummary {
  readonly processed: number;
  readonly errors: number;
}

/** Run all pipelines for one user under the transaction/lease. */
export async function computeUser(userId: string): Promise<void> {
  await withInsightTransaction(userId, async (tx) => {
    // The transaction owns the per-user lease and the same user-row lock taken
    // by result/import/delete mutations. The bounded read and replacement are
    // therefore one freshness-consistent snapshot.
    const records = await fetchWorkoutRecords(userId, tx);
    await deleteComputedInsights(userId, tx);

    if (records.length > 0) {
      const volume = computeVolume(records);
      if (volume !== null) await upsertInsight(userId, 'volume_trend', null, volume, tx);

      const frequency = computeFrequency(records);
      if (frequency !== null) await upsertInsight(userId, 'frequency', null, frequency, tx);

      for (const [exerciseId, payload] of computeE1rmPerExercise(records)) {
        await upsertInsight(userId, 'e1rm_progression', exerciseId, payload, tx);
      }
      for (const [exerciseId, payload] of computeSummaryPerExercise(records)) {
        await upsertInsight(userId, 'exercise_summary', exerciseId, payload, tx);
      }
      for (const [exerciseId, payload] of computePlateauPerExercise(records)) {
        await upsertInsight(userId, 'plateau_detection', exerciseId, payload, tx);
      }
      for (const [exerciseId, payload] of computeForecastPerExercise(records)) {
        await upsertInsight(userId, 'e1rm_forecast', exerciseId, payload, tx);
      }
      for (const [exerciseId, payload] of computeRecommendationPerExercise(records)) {
        await upsertInsight(userId, 'load_recommendation', exerciseId, payload, tx);
      }
    }

    // Advance the fairness cursor only when the complete snapshot commits.
    await upsertInsight(userId, META_INSIGHT_TYPE, null, {}, tx);
  });
}

/** Run the compute for every eligible user. Returns a processed/errors summary. */
export async function runAll(): Promise<RunAllSummary> {
  const users = await fetchAllUsers();
  logger.info({ userCount: users.length }, 'analytics: starting compute');

  let processed = 0;
  let errors = 0;
  for (const user of users) {
    try {
      await computeUser(user.userId);
      processed += 1;
    } catch (error) {
      logger.error({ err: error, userId: user.userId }, 'analytics: compute failed for user');
      errors += 1;
    }
  }

  logger.info({ processed, errors }, 'analytics: compute done');
  return { processed, errors };
}
