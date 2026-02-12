const ERROR_MAP: ReadonlyMap<string, string> = new Map([
  ['Invalid login credentials', 'Invalid email or password.'],
  ['Email not confirmed', 'Please check your email and confirm your account.'],
  ['User already registered', 'An account with this email already exists.'],
  ['Supabase not configured', 'Cloud sync is not available right now.'],
  ['Password should be at least 6 characters', 'Password must be at least 6 characters.'],
]);

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

export function sanitizeAuthError(rawMessage: string): string {
  const exact = ERROR_MAP.get(rawMessage);
  if (exact) return exact;

  for (const [key, friendly] of ERROR_MAP) {
    if (rawMessage.includes(key)) return friendly;
  }

  return GENERIC_MESSAGE;
}
