/**
 * Auth service tests — pure functions only (no DB connection required).
 * DB-dependent functions are covered by integration tests (future work).
 */
import { describe, it, expect } from 'bun:test';
import { generateRefreshToken, hashToken, REFRESH_TOKEN_DAYS } from './auth';

// ---------------------------------------------------------------------------
// Refresh token generation
// ---------------------------------------------------------------------------

describe('generateRefreshToken', () => {
  it('should return a non-empty string', () => {
    const token = generateRefreshToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('should return a UUID-format string', () => {
    const token = generateRefreshToken();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(uuidPattern.test(token)).toBe(true);
  });

  it('should generate unique tokens', () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateRefreshToken()));
    expect(tokens.size).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Token hashing
// ---------------------------------------------------------------------------

describe('hashToken', () => {
  it('should return a 64-character hex string (SHA-256)', async () => {
    const hash = await hashToken('some-token');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it('should be deterministic — same input always gives same hash', async () => {
    const token = 'deterministic-token';
    const hash1 = await hashToken(token);
    const hash2 = await hashToken(token);
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', async () => {
    const hash1 = await hashToken('token-a');
    const hash2 = await hashToken('token-b');
    expect(hash1).not.toBe(hash2);
  });

  it('should match known SHA-256 output', async () => {
    // SHA-256('') = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    const hash = await hashToken('');
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('REFRESH_TOKEN_DAYS', () => {
  it('should be 7', () => {
    expect(REFRESH_TOKEN_DAYS).toBe(7);
  });
});
