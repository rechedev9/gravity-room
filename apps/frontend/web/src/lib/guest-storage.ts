import { ProgramInstanceMapSchema } from '@gzclp/domain/schemas/instance';
import type { ProgramInstance, ProgramInstanceMap } from '@gzclp/domain/types/program';

/**
 * Typed localStorage read/write for guest-mode program data. Guest sessions
 * are unauthenticated, so their program instances live entirely on-device —
 * this is the only persistence layer they get. Data is Zod-validated on read
 * so a corrupted or hand-edited localStorage value degrades to "no guest
 * data" instead of crashing the app.
 */

export const GUEST_STORAGE_KEY = 'gzclp_guest_v1' as const;

/**
 * Timestamp (ms) stamped when a guest clicks "Create Account", marking their
 * data as intended for migration into the account they are about to create.
 * The migration hook only imports guest data while this marker is fresh, so
 * data abandoned on a shared browser cannot leak into an unrelated account
 * that signs in later.
 */
export const GUEST_MIGRATION_MARKER_KEY = 'gzclp_guest_migration_pending_v1' as const;

/** Reads and Zod-validates guest data from localStorage. Returns null if absent or invalid. */
export function readGuestData(): ProgramInstanceMap | null {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const result = ProgramInstanceMapSchema.safeParse(parsed);
    if (!result.success) return null;
    return result.data;
  } catch {
    return null;
  }
}

/**
 * The guest's active program instance, if any. Single accessor for the
 * activeProgramId -> instances lookup so the storage shape is not re-derived
 * at every consumer.
 */
export function readActiveGuestInstance(): ProgramInstance | null {
  const data = readGuestData();
  if (!data || data.activeProgramId === null) return null;
  return data.instances[data.activeProgramId] ?? null;
}

/** Stamps guest data as pending migration into a soon-to-be-created account. */
export function setGuestMigrationMarker(now: number = Date.now()): void {
  try {
    localStorage.setItem(GUEST_MIGRATION_MARKER_KEY, String(now));
  } catch {
    // ignore storage errors
  }
}

/** Reads the migration marker timestamp (ms), or null when absent/invalid. */
export function readGuestMigrationMarker(): number | null {
  try {
    const raw = localStorage.getItem(GUEST_MIGRATION_MARKER_KEY);
    if (!raw) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

/** Removes the migration marker. */
export function clearGuestMigrationMarker(): void {
  try {
    localStorage.removeItem(GUEST_MIGRATION_MARKER_KEY);
  } catch {
    // ignore storage errors
  }
}

/** Writes guest data to localStorage. Returns true on success. */
export function writeGuestData(data: ProgramInstanceMap): boolean {
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Removes all guest data from localStorage. */
export function clearGuestData(): void {
  try {
    localStorage.removeItem(GUEST_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

/** Creates an empty ProgramInstanceMap for a new guest session. */
export function createEmptyGuestMap(): ProgramInstanceMap {
  return {
    version: 1,
    activeProgramId: null,
    instances: {},
  };
}
