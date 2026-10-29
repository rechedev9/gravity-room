import { useSyncExternalStore } from 'react';

/**
 * Matches the Tailwind `lg` breakpoint (the default 64rem = 1024px; the web app
 * does not override it). Keep this query in lockstep with the `lg:` utilities so
 * the desktop shell mounts at exactly the same width Tailwind switches layouts.
 */
const LG_MEDIA_QUERY = '(min-width: 64rem)';

function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

function subscribe(onStoreChange: () => void): () => void {
  if (!hasMatchMedia()) return () => undefined;
  const mql = window.matchMedia(LG_MEDIA_QUERY);
  mql.addEventListener('change', onStoreChange);
  return () => mql.removeEventListener('change', onStoreChange);
}

function getSnapshot(): boolean {
  if (!hasMatchMedia()) return false;
  return window.matchMedia(LG_MEDIA_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * True at the Tailwind `lg` breakpoint and above. SSR and matchMedia-less
 * environments resolve to false so the phone layout stays the default.
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
