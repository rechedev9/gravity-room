const ERROR_MAP: ReadonlyMap<string, string> = new Map([
  ['Invalid Google credential', 'auth.errors.google_failed'],
  ['No refresh token', 'auth.errors.session_expired'],
  ['Invalid refresh token', 'auth.errors.session_expired'],
  ['Refresh token expired', 'auth.errors.session_expired'],
]);

const GENERIC_KEY = 'auth.errors.generic';

export function sanitizeAuthError(rawMessage: string): string {
  const exact = ERROR_MAP.get(rawMessage);
  if (exact) return exact;

  for (const [key, mapped] of ERROR_MAP) {
    if (rawMessage.includes(key)) return mapped;
  }

  return GENERIC_KEY;
}
