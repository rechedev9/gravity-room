const SHORTCUTS_STORAGE_KEY = ['gr', 'shortcuts', 'seen', 'v1'].join('-');

export function hasSeenShortcuts(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(SHORTCUTS_STORAGE_KEY) === '1';
  } catch {
    return true; // defensive: SSR / storage blocked → don't pester
  }
}

export function markShortcutsSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}
