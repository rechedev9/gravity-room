/**
 * Auth service tests — pure functions only.
 *
 * Token helpers (generateRefreshToken, hashToken) and the identity-linking
 * policy (decideIdentityLink, isUniqueViolation) are pure and need no DB. The
 * DB-backed flows (findOrCreateUserByIdentity, refresh-token rotation) are
 * exercised against a real Postgres in the integration suite
 * (test/e2e/auth-identity.e2e.test.ts) and via the API boot in CI.
 */
process.env['DATABASE_URL'] = 'postgres://test:test@localhost:5432/test';
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect } from 'bun:test';

import {
  generateRefreshToken,
  hashToken,
  REFRESH_TOKEN_DAYS,
  decideIdentityLink,
  isUniqueViolation,
} from './auth';

// ---------------------------------------------------------------------------
// Refresh token generation
// ---------------------------------------------------------------------------

describe('generateRefreshToken', () => {
  it('should return a non-empty string', () => {
    const token = generateRefreshToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });

  it('should return 256 bits of entropy as a 64-char hex string', () => {
    const token = generateRefreshToken();
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
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

// ---------------------------------------------------------------------------
// Identity-linking policy (anti-takeover guard)
// ---------------------------------------------------------------------------

describe('decideIdentityLink', () => {
  it('links when both the incoming and existing emails are verified', () => {
    expect(decideIdentityLink(true, { emailVerified: true, isDeleted: false })).toBe('link');
  });

  it('conflicts when the incoming email is unverified', () => {
    expect(decideIdentityLink(false, { emailVerified: true, isDeleted: false })).toBe('conflict');
  });

  it('conflicts when the existing account email is unverified', () => {
    expect(decideIdentityLink(true, { emailVerified: false, isDeleted: false })).toBe('conflict');
  });

  it('conflicts when neither side is verified', () => {
    expect(decideIdentityLink(false, { emailVerified: false, isDeleted: false })).toBe('conflict');
  });

  it('reports account_deleted for a soft-deleted account regardless of verification', () => {
    expect(decideIdentityLink(true, { emailVerified: true, isDeleted: true })).toBe(
      'account_deleted'
    );
    expect(decideIdentityLink(false, { emailVerified: false, isDeleted: true })).toBe(
      'account_deleted'
    );
  });
});

// ---------------------------------------------------------------------------
// Postgres unique-violation detection (drives the create-race retry)
// ---------------------------------------------------------------------------

describe('isUniqueViolation', () => {
  it('is true for a Postgres 23505 error', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('is false for other Postgres error codes', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
  });

  it('is false for non-objects and nullish values', () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation('23505')).toBe(false);
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
  });
});
