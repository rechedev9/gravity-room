export type SyncAge =
  | { readonly kind: 'just_now' }
  | { readonly kind: 'minutes' | 'hours'; readonly count: number }
  | { readonly kind: 'date' };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Coarse on purpose: a sync status needs "a few minutes ago", not a clock. */
export function describeSyncAge(now: number, syncedAt: number): SyncAge {
  const elapsed = Math.max(0, now - syncedAt);
  if (elapsed < MINUTE) return { kind: 'just_now' };
  if (elapsed < HOUR) return { kind: 'minutes', count: Math.floor(elapsed / MINUTE) };
  if (elapsed < DAY) return { kind: 'hours', count: Math.floor(elapsed / HOUR) };
  return { kind: 'date' };
}
