import { describe, expect, it } from 'vitest';
import { shouldAutoShowKeyboardShortcuts } from './shortcuts-policy';

describe('shouldAutoShowKeyboardShortcuts', () => {
  it('opens once on desktop when the grid is ready and unseen', () => {
    expect(
      shouldAutoShowKeyboardShortcuts({
        enabled: true,
        hasSeen: false,
        prefersCoarsePointer: false,
      })
    ).toBe(true);
  });

  it('never auto-opens on touch-primary devices', () => {
    expect(
      shouldAutoShowKeyboardShortcuts({
        enabled: true,
        hasSeen: false,
        prefersCoarsePointer: true,
      })
    ).toBe(false);
  });

  it('stays closed after the user has already dismissed it', () => {
    expect(
      shouldAutoShowKeyboardShortcuts({
        enabled: true,
        hasSeen: true,
        prefersCoarsePointer: false,
      })
    ).toBe(false);
  });

  it('stays closed when the workout grid is not ready', () => {
    expect(
      shouldAutoShowKeyboardShortcuts({
        enabled: false,
        hasSeen: false,
        prefersCoarsePointer: false,
      })
    ).toBe(false);
  });
});
