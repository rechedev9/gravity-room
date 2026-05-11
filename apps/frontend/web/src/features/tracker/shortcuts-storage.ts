const KEY = 'gr-shortcuts-seen-v1';

export function hasSeenShortcuts(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true; // defensive: SSR / storage blocked → don't pester
  }
}

export function markShortcutsSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
}
