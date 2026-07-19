import { isRecord } from '@gzclp/domain/type-guards';
import type { SetLogEntry } from '@gzclp/domain/types';

// ---------------------------------------------------------------------------
// In-progress set-log persistence
//
// The tracker keeps mid-workout set confirmations (and the reps recorded with
// each confirmed set) in React state inside `useSetLogging`. That state is lost
// on reload, so a gym user who reloads — or whose mobile browser evicts the tab —
// loses their in-progress workout. This module persists that map to localStorage,
// scoped per user + program + instance so it never leaks between a dev login, a
// guest session, and different accounts on the same browser.
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = 'gravity-room:set-logs';

export interface SetLogsScope {
  /** Authenticated user id, or `null` for guest / not-yet-resolved sessions. */
  readonly userId: string | null;
  readonly programId: string;
  readonly instanceId?: string | undefined;
}

/**
 * Builds the localStorage key for a scope. Guest sessions and each program
 * instance get their own key, so nothing bleeds across users, guest mode, or
 * separate program runs on the same device.
 */
export function buildSetLogsStorageKey(scope: SetLogsScope): string {
  const owner = scope.userId ?? 'guest';
  const instance = scope.instanceId ?? 'default';
  return [STORAGE_PREFIX, owner, scope.programId, instance].join('|');
}

type SetLogsMap = ReadonlyMap<string, readonly SetLogEntry[]>;

function parseEntry(value: unknown): SetLogEntry | null {
  if (!isRecord(value)) return null;
  if (typeof value.reps !== 'number' || !Number.isFinite(value.reps)) return null;
  const entry: { reps: number; weight?: number; rpe?: number } = { reps: value.reps };
  if (typeof value.weight === 'number' && Number.isFinite(value.weight)) {
    entry.weight = value.weight;
  }
  if (typeof value.rpe === 'number' && Number.isFinite(value.rpe)) {
    entry.rpe = value.rpe;
  }
  return entry;
}

function parseLogs(value: unknown): readonly SetLogEntry[] | null {
  if (!Array.isArray(value)) return null;
  const logs: SetLogEntry[] = [];
  for (const raw of value) {
    const entry = parseEntry(raw);
    if (entry === null) return null;
    logs.push(entry);
  }
  return logs;
}

/**
 * Reads and validates a persisted set-log map. Returns an empty map when the
 * key is absent, unreadable, or malformed — a corrupt payload must never crash
 * the tracker or resurrect partial garbage.
 */
export function restoreSetLogs(key: string): Map<string, readonly SetLogEntry[]> {
  const result = new Map<string, readonly SetLogEntry[]>();
  if (typeof window === 'undefined') return result;

  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return result;
  }
  if (raw === null) return result;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return result;
  }
  if (!Array.isArray(parsed)) return result;

  for (const pair of parsed) {
    if (!Array.isArray(pair) || pair.length !== 2) continue;
    const [slotKey, logsRaw] = pair;
    if (typeof slotKey !== 'string') continue;
    const logs = parseLogs(logsRaw);
    if (logs === null || logs.length === 0) continue;
    result.set(slotKey, logs);
  }

  return result;
}

/**
 * Persists a set-log map. An empty map removes the key entirely so a completed
 * or reset day leaves no residue behind.
 */
export function saveSetLogs(key: string, logs: SetLogsMap): void {
  if (typeof window === 'undefined') return;
  try {
    if (logs.size === 0) {
      localStorage.removeItem(key);
      return;
    }
    const serialized = Array.from(logs.entries());
    localStorage.setItem(key, JSON.stringify(serialized));
  } catch {
    /* storage unavailable / quota exceeded — degrade to in-memory only */
  }
}

/** Removes any persisted set-log map for a key. */
export function clearStoredSetLogs(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
