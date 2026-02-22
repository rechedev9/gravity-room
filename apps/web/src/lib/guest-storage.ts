import { ProgramInstanceMapSchema } from '@gzclp/shared/schemas/instance';
import type { ProgramInstanceMap } from '@gzclp/shared/types/program';

export const GUEST_STORAGE_KEY = 'gzclp_guest_v1' as const;

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
  localStorage.removeItem(GUEST_STORAGE_KEY);
}

/** Creates an empty ProgramInstanceMap for a new guest session. */
export function createEmptyGuestMap(): ProgramInstanceMap {
  return {
    version: 1,
    activeProgramId: null,
    instances: {},
  };
}
