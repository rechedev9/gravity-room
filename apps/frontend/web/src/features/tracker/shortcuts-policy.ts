/**
 * Whether the first-run keyboard shortcuts dialog should auto-open.
 *
 * Gym tracking on touch-primary devices is set-first (tap confirm per set);
 * S/F keyboard shortcuts are ignored in detailed mode and a modal over the
 * grid blocks the primary action. Desktop keeps the one-time tip.
 */
export function shouldAutoShowKeyboardShortcuts(options: {
  readonly enabled: boolean;
  readonly hasSeen: boolean;
  readonly prefersCoarsePointer: boolean;
}): boolean {
  if (!options.enabled || options.hasSeen) return false;
  if (options.prefersCoarsePointer) return false;
  return true;
}

/** True when the primary pointer is coarse (typical phones / tablets). */
export function prefersCoarsePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}
