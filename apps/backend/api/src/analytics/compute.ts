/**
 * Analytics compute orchestrator.
 *
 * Ports apps/backend/analytics/compute.py: for each user it fetches the workout
 * records once, runs all seven pipelines, and upserts each result with the
 * matching `insight_type` string (and null vs. exercise_id distinction). The
 * upsert makes a per-user run idempotent, so a crashed/retried cron tick is
 * safe to replay.
 */

import { logger } from '../lib/logger';
import {
  fetchAllUsers,
  fetchWorkoutRecords,
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

/**
 * Run all pipelines for a single user and upsert every result.
 *
 * The `_meta` cursor marker is committed FIRST in its own autocommit statement,
 * OUTSIDE the insight transaction, so the user's computed_at always advances even
 * if the insight pipeline below throws or the statement_timeout rolls the
 * transaction back. The seven insight upserts then run inside one transaction so a
 * user's insights commit atomically: a crash mid-run rolls back instead of leaving
 * a half-updated set, and because each upsert is idempotent the tick is safe to
 * replay.
 */
export async function computeUser(userId: string): Promise<void> {
  const records = await fetchWorkoutRecords(userId);

  // Always advance this user's cursor, even with zero records, by upserting the
  // `_meta` marker row in its own autocommit statement OUTSIDE the transaction.
  // fetchLeastRecentlyComputedUsers orders by max(computed_at) NULLS FIRST, so a
  // user whose computed_at never advanced would be re-selected on every tick and
  // starve users who have data. Committing the marker independently of the insight
  // transaction means a failed insight pipeline can no longer roll the marker back
  // and re-introduce that cron starvation. The marker is filtered out of
  // GET /api/insights.
  await upsertInsight(userId, META_INSIGHT_TYPE, null, {});

  // A record-less user has no insights to compute; the marker above is enough.
  if (records.length === 0) return;

  await withInsightTransaction(async (tx) => {
    // Volume trend (aggregate, no exercise_id).
    const volume = computeVolume(records);
    if (volume !== null) await upsertInsight(userId, 'volume_trend', null, volume, tx);

    // Frequency (aggregate, no exercise_id).
    const frequency = computeFrequency(records);
    if (frequency !== null) await upsertInsight(userId, 'frequency', null, frequency, tx);

    // Per-exercise insights.
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
