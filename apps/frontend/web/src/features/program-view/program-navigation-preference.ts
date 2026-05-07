/**
 * Persistent storage for the calendar navigation mode (day | week | month).
 *
 * Intentionally separate from the compact/detailed ViewMode preference so the
 * two settings remain fully independent.
 *
 * Storage key: gravity-room:program-navigation-mode:v1
 * Values:      'day' | 'week' | 'month'
 */

export type NavMode = 'day' | 'week' | 'month';

const STORAGE_KEY = 'gravity-room:program-navigation-mode:v1';
const DEFAULT_MODE: NavMode = 'week';
const VALID_MODES = new Set<string>(['day', 'week', 'month']);

function isNavMode(value: unknown): value is NavMode {
  return typeof value === 'string' && VALID_MODES.has(value);
}

export function loadNavMode(): NavMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null && isNavMode(raw)) return raw;
  } catch {
    // localStorage unavailable (SSR, private browsing, etc.)
  }
  return DEFAULT_MODE;
}

export function saveNavMode(mode: NavMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore write failures silently
  }
}
