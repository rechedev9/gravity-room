import { ProgramInstanceMapSchema } from '@gzclp/domain/schemas/instance';
import type { ProgramInstance, ProgramInstanceMap } from '@gzclp/domain/types/program';
import { GUEST_STORAGE_KEY } from './guest-storage-keys';

/**
 * Typed localStorage read/write for guest-mode program data. Guest sessions
 * are unauthenticated, so their program instances live entirely on-device —
 * this is the only persistence layer they get. Data is Zod-validated on read
 * so a corrupted or hand-edited localStorage value degrades to "no guest
 * data" instead of crashing the app.
 *
 * Only the readers below pull in the Zod schema; the schema-free keys, writes
 * and clears live in guest-storage-keys.ts and are re-exported here so callers
 * keep a single import site. Modules on the pre-paint path (guest-context)
 * should import from guest-storage-keys.ts directly — see that file for why.
 */

export {
  GUEST_STORAGE_KEY,
  GUEST_MIGRATION_MARKER_KEY,
  setGuestMigrationMarker,
  readGuestMigrationMarker,
  clearGuestMigrationMarker,
  writeGuestData,
  clearGuestData,
  createEmptyGuestMap,
} from './guest-storage-keys';

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
