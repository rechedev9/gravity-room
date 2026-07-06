import type { QueryClient } from '@tanstack/react-query';
import type { ProgramInstance } from '@gzclp/domain/types/program';
import { ApiError } from '@gzclp/api-client/api-error';
import { fetchPrograms, importProgram } from '@/lib/api-functions';
import { queryKeys } from '@/lib/query-keys';
import {
  clearGuestData,
  clearGuestMigrationMarker,
  readActiveGuestInstance,
  readGuestMigrationMarker,
} from '@/lib/guest-storage';

/**
 * Guest -> account migration.
 *
 * Guests keep a single in-progress program in localStorage (see
 * lib/guest-storage.ts). When such a guest creates an account and authenticates
 * for the first time, that on-device program should follow them to the server
 * instead of being thrown away.
 *
 * The migration is a single atomic `POST /programs/import` request: the server
 * validates every result against the program definition and writes program +
 * results in one transaction. A per-result replay was rejected on purpose - it
 * hits the record-result rate limit for long-running guests and a mid-replay
 * failure would leave a half-migrated program.
 *
 * Safety rules:
 * - Migration only runs while the "pending" marker set by the Create Account
 *   CTA is fresh (see MIGRATION_MARKER_TTL_MS). Guest data found WITHOUT a
 *   fresh marker is purged instead of imported: on a shared browser it most
 *   likely belongs to an earlier, unrelated person, and importing it would
 *   contaminate whichever account signs in next.
 * - If the account already has an ACTIVE program, the migration is skipped and
 *   the guest data kept: creating a new instance would silently auto-complete
 *   the account's real in-flight program (see services/programs.ts). The guest
 *   copy migrates on a later sign-in once no active program remains.
 * - A transient import failure keeps the guest data (and marker) so a later
 *   sign-in can retry; a permanent rejection (4xx validation) purges it so it
 *   does not re-fail on every sign-in forever. Never blocks login.
 */

/**
 * How long the Create Account marker stays valid. Generous on purpose: the
 * email signup flow legitimately spans hours (verification link opened much
 * later). It only needs to be far shorter than "forever".
 */
const MIGRATION_MARKER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 4xx responses other than rate-limit/auth mean the payload will never be accepted. */
function isPermanentRejection(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status >= 400 &&
    err.status < 500 &&
    err.status !== 401 &&
    err.status !== 429
  );
}

function purgeGuestData(): void {
  clearGuestData();
  clearGuestMigrationMarker();
}

export interface GuestMigrationResult {
  /** Catalog program id, for localizing the program name in the success toast. */
  readonly programId: string;
  /** Stored program name (fallback for localization). */
  readonly programName: string;
}

/** Builds the `POST /programs/import` payload from a guest instance. */
function buildImportPayload(instance: ProgramInstance): Record<string, unknown> {
  // The import schema accepts result/amrapReps/rpe per slot; setLogs is a
  // client-side detail the endpoint does not take, so it is stripped here.
  const results: Record<string, Record<string, unknown>> = {};
  for (const [workoutIndex, workout] of Object.entries(instance.results)) {
    const slots: Record<string, unknown> = {};
    for (const [slotId, slot] of Object.entries(workout)) {
      if (!slot.result) continue; // only slots with a recorded pass/fail
      slots[slotId] = {
        result: slot.result,
        ...(slot.amrapReps !== undefined ? { amrapReps: slot.amrapReps } : {}),
        ...(slot.rpe !== undefined ? { rpe: slot.rpe } : {}),
      };
    }
    if (Object.keys(slots).length > 0) results[workoutIndex] = slots;
  }

  return {
    version: 1,
    exportDate: new Date().toISOString(),
    programId: instance.programId,
    name: instance.name,
    config: instance.config,
    results,
    undoHistory: [],
  };
}

/**
 * Migrates the guest's in-progress program to the authenticated account.
 * Returns a summary on success, or `null` when there was nothing to migrate,
 * the account already has an active program, or the import failed (guest data
 * is kept in the last two cases).
 */
export async function migrateGuestDataToAccount(
  queryClient: QueryClient
): Promise<GuestMigrationResult | null> {
  const instance = readActiveGuestInstance();
  if (!instance) return null;

  // Only migrate data explicitly marked by this browser's Create Account
  // click, and only while the marker is fresh. Anything else (abandoned or
  // legacy data) is purged so it can never leak into an unrelated account.
  const marker = readGuestMigrationMarker();
  if (marker === null || Date.now() - marker > MIGRATION_MARKER_TTL_MS) {
    console.warn('[guest-migration] Guest data without a fresh migration marker; purging.');
    purgeGuestData();
    return null;
  }

  // Never displace an account's real program: creating/importing while one is
  // active would auto-complete it server-side. Keep the guest data and retry
  // on a later sign-in.
  try {
    const programs = await queryClient.fetchQuery({
      queryKey: queryKeys.programs.all,
      queryFn: fetchPrograms,
    });
    if (programs.some((p) => p.status === 'active')) {
      console.warn('[guest-migration] Account already has an active program; skipping migration.');
      return null;
    }
  } catch (err: unknown) {
    console.warn(
      '[guest-migration] Could not check existing programs; keeping guest data:',
      err instanceof Error ? err.message : 'Unknown error'
    );
    return null;
  }

  try {
    await importProgram(buildImportPayload(instance));
  } catch (err: unknown) {
    if (isPermanentRejection(err)) {
      // The server will never accept this payload; purge it instead of
      // re-failing the import on every future sign-in.
      console.warn(
        '[guest-migration] Import permanently rejected; discarding guest data:',
        err instanceof Error ? err.message : 'Unknown error'
      );
      purgeGuestData();
      return null;
    }
    // Transient failure: keep the guest data so a later sign-in can retry.
    console.warn(
      '[guest-migration] Import failed; keeping guest data:',
      err instanceof Error ? err.message : 'Unknown error'
    );
    return null;
  }

  // The program now lives on the server - drop the local copy and refresh the
  // program list so the dashboard reflects the migrated program immediately.
  purgeGuestData();
  await queryClient.invalidateQueries({ queryKey: queryKeys.programs.all, exact: true });

  return {
    programId: instance.programId,
    programName: instance.name,
  };
}
