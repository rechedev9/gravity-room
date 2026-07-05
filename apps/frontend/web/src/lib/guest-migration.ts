import type { QueryClient } from '@tanstack/react-query';
import type { ProgramInstance } from '@gzclp/domain/types/program';
import { createProgram, recordGenericResult } from '@/lib/api-functions';
import type { ProgramSummary } from '@/lib/api-functions';
import { queryKeys } from '@/lib/query-keys';
import { readGuestData, clearGuestData } from '@/lib/guest-storage';

/**
 * Guest → account migration.
 *
 * Guests keep a single in-progress program in localStorage (see
 * lib/guest-storage.ts). When such a guest creates an account and authenticates
 * for the first time, that on-device program should follow them to the server
 * instead of being thrown away. This module performs that one-shot migration
 * with the existing program mutations (create + record-result), then clears the
 * local copy.
 *
 * Failure is non-fatal by design: it must never block login. If creating the
 * program on the server fails the guest data is left untouched so a later
 * attempt can retry; individual result failures are logged and skipped (the
 * program itself is the essential part) and the local copy is still cleared to
 * avoid creating a duplicate on the next sign-in.
 */

export interface GuestMigrationResult {
  /** Catalog program id, for localizing the program name in the success toast. */
  readonly programId: string;
  /** Stored program name (fallback for localization). */
  readonly programName: string;
  /** Number of workout results successfully migrated. */
  readonly migratedResults: number;
  /** Number of workout results that failed to migrate (logged, non-fatal). */
  readonly failedResults: number;
}

/** Picks the guest's active instance, if any. */
function activeGuestInstance(): ProgramInstance | null {
  const guestData = readGuestData();
  if (!guestData || guestData.activeProgramId === null) return null;
  return guestData.instances[guestData.activeProgramId] ?? null;
}

/**
 * Migrates the guest's in-progress program to the authenticated account.
 * Returns a summary on success, or `null` when there was nothing to migrate or
 * the program could not be created on the server (guest data is kept in the
 * latter case).
 */
export async function migrateGuestDataToAccount(
  queryClient: QueryClient
): Promise<GuestMigrationResult | null> {
  const instance = activeGuestInstance();
  if (!instance) return null;

  let created: ProgramSummary;
  try {
    created = await createProgram(instance.programId, instance.name, instance.config);
  } catch (err: unknown) {
    // Keep the guest data so the migration can be retried on a later sign-in.
    console.warn(
      '[guest-migration] Failed to create program on server; keeping guest data:',
      err instanceof Error ? err.message : 'Unknown error'
    );
    return null;
  }

  // Replay every recorded result onto the new server instance. Ascending workout
  // order is the natural progression order; individual failures are tolerated.
  let migratedResults = 0;
  let failedResults = 0;
  const workoutIndexes = Object.keys(instance.results)
    .map((k) => Number(k))
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b);

  for (const index of workoutIndexes) {
    const workout = instance.results[String(index)];
    if (!workout) continue;
    for (const [slotId, slot] of Object.entries(workout)) {
      if (!slot.result) continue; // only slots with a recorded pass/fail
      try {
        await recordGenericResult(
          created.id,
          index,
          slotId,
          slot.result,
          slot.amrapReps,
          slot.rpe,
          slot.setLogs
        );
        migratedResults += 1;
      } catch (err: unknown) {
        failedResults += 1;
        console.warn(
          `[guest-migration] Failed to migrate result (workout ${String(index)}, slot ${slotId}):`,
          err instanceof Error ? err.message : 'Unknown error'
        );
      }
    }
  }

  // The program now lives on the server — drop the local copy and refresh the
  // program list so the dashboard reflects the migrated program immediately.
  clearGuestData();
  await queryClient.invalidateQueries({ queryKey: queryKeys.programs.all, exact: true });

  return {
    programId: instance.programId,
    programName: instance.name,
    migratedResults,
    failedResults,
  };
}
