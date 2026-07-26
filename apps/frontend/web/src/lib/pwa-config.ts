/**
 * Keep new service workers waiting until the user accepts the in-app update
 * prompt. Auto-activation can replace the running asset graph mid-workout.
 */
export const PWA_REGISTER_TYPE = 'prompt' as const;

/**
 * Only endpoints whose response is identical for every user belong in the
 * shared runtime cache. `/api/exercises` is intentionally absent because an
 * authenticated request includes the current user's custom exercises.
 */
export const PUBLIC_API_CACHE_PATTERN = /\/api\/(?:catalog|muscle-groups|stats\/online)(?:\/|$|\?)/;
