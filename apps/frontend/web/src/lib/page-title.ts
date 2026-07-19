/**
 * Canonical landing/default document title. Kept in sync with the static
 * `<title>` in index.html and the ES landing head (features/landing/index.tsx)
 * so the initial (prerendered) title matches the post-hydration one exactly.
 * Restored by route-level useEffect cleanups on unmount.
 */
export const DEFAULT_PAGE_TITLE =
  'Gravity Room — Planes de fuerza gratis con progresión automática';
