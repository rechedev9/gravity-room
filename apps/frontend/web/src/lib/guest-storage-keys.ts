/**
 * Schema-free half of the guest localStorage layer: keys, writes, clears and
 * the migration marker.
 *
 * Split from guest-storage.ts because guest-context sits on the pre-paint path
 * and only clears data / stamps the migration marker. Reading guest data is the
 * one operation that needs `ProgramInstanceMapSchema`, and importing that from
 * the entry graph dragged the Zod runtime (~20 KB gz) into every page load,
 * including the public landing. Keeping the write-side here lets the schema
 * stay in the lazy chunks that actually read guest data.
 */
import type { ProgramInstanceMap } from '@gzclp/domain/types/program';

export const GUEST_STORAGE_KEY = 'gzclp_guest_v1' as const;

/**
 * Timestamp (ms) stamped when a guest clicks "Create Account". A fresh marker
 * allows the signed-in user to see an informed import/discard prompt; it never
 * authorizes an automatic import.
 */
export const GUEST_MIGRATION_MARKER_KEY = 'gzclp_guest_migration_pending_v1' as const;

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
