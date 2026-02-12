import { describe, it, expect } from 'bun:test';
import { sanitizeAuthError } from './auth-errors';

// ---------------------------------------------------------------------------
// sanitizeAuthError — public API mapping, integration-style
// Tests the full mapping contract: if Supabase returns X, the user sees Y.
// ---------------------------------------------------------------------------
describe('sanitizeAuthError', () => {
  it('should map all known error messages to user-friendly strings', () => {
    // This is a snapshot of the entire error mapping contract.
    // If a mapping changes, this test MUST break — that's CI.
    const mappings: Array<[string, string]> = [
      ['Invalid login credentials', 'Invalid email or password.'],
      ['Email not confirmed', 'Please check your email and confirm your account.'],
      ['User already registered', 'An account with this email already exists.'],
      ['Supabase not configured', 'Cloud sync is not available right now.'],
      ['Password should be at least 6 characters', 'Password must be at least 6 characters.'],
    ];

    for (const [raw, expected] of mappings) {
      expect(sanitizeAuthError(raw)).toBe(expected);
    }
  });

  it('should match partial messages containing known error strings', () => {
    const result = sanitizeAuthError('Error: Invalid login credentials for user@example.com');
    expect(result).toBe('Invalid email or password.');
  });

  it('should return generic message for unknown errors', () => {
    const result = sanitizeAuthError('Database connection timeout');
    expect(result).toBe('Something went wrong. Please try again.');
  });

  it('should return generic message for empty string', () => {
    expect(sanitizeAuthError('')).toBe('Something went wrong. Please try again.');
  });
});
