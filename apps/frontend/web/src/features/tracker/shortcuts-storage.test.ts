import { describe, it, expect, beforeEach } from 'bun:test';
import { hasSeenShortcuts, markShortcutsSeen } from './shortcuts-storage';

describe('shortcuts-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns false when never seen', () => {
    expect(hasSeenShortcuts()).toBe(false);
  });

  it('returns true after marking seen', () => {
    markShortcutsSeen();
    expect(hasSeenShortcuts()).toBe(true);
  });
});
