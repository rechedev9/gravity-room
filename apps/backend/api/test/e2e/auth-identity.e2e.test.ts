/**
 * Integration tests for the multi-provider identity resolver against a real
 * Postgres. Run with: DATABASE_URL_TEST=... pnpm --filter api test:e2e
 *
 * Covers create / returning / link / conflict / soft-delete and the Google
 * back-compat wrapper — the DB-backed paths the mocked unit suite can't reach.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { users, userIdentities } from '@gzclp/database/schema';
import { setupTestDb, teardownTestDb, truncateAllTables } from '../db-setup';
import {
  findOrCreateUserByIdentity,
  findOrCreateGoogleUser,
  softDeleteUser,
} from '../../src/services/auth';
import { getDb } from '../../src/db';
import { ApiError } from '../../src/middleware/error-handler';

beforeAll(async () => {
  await setupTestDb();
});

afterEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await teardownTestDb();
});

describe('findOrCreateUserByIdentity (integration)', () => {
  it('creates a user and identity on first sign-in, lowercasing the email', async () => {
    const { user, isNewUser } = await findOrCreateUserByIdentity({
      provider: 'github',
      providerAccountId: 'gh-1',
      email: 'Neo@Example.com',
      emailVerified: true,
      name: 'Neo',
    });

    expect(isNewUser).toBe(true);
    expect(user.email).toBe('neo@example.com');
    expect(user.emailVerified).toBe(true);
    expect(user.googleId).toBeNull();

    const identities = await getDb()
      .select()
      .from(userIdentities)
      .where(eq(userIdentities.userId, user.id));
    expect(identities).toHaveLength(1);
    expect(identities[0]?.provider).toBe('github');
    expect(identities[0]?.providerAccountId).toBe('gh-1');
  });

  it('returns the same user without duplicating on repeat sign-in', async () => {
    const first = await findOrCreateUserByIdentity({
      provider: 'github',
      providerAccountId: 'gh-1',
      email: 'neo@example.com',
      emailVerified: true,
      name: 'Neo',
    });
    const second = await findOrCreateUserByIdentity({
      provider: 'github',
      providerAccountId: 'gh-1',
      email: 'neo@example.com',
      emailVerified: true,
      name: 'Neo',
    });

    expect(second.isNewUser).toBe(false);
    expect(second.user.id).toBe(first.user.id);

    const allUsers = await getDb().select().from(users);
    expect(allUsers).toHaveLength(1);
  });

  it('links a new provider to an existing verified account by email', async () => {
    const google = await findOrCreateGoogleUser('g-1', 'trinity@example.com', 'Trinity');
    expect(google.user.emailVerified).toBe(true);

    const github = await findOrCreateUserByIdentity({
      provider: 'github',
      providerAccountId: 'gh-2',
      email: 'trinity@example.com',
      emailVerified: true,
      name: 'Trinity',
    });

    expect(github.isNewUser).toBe(false);
    expect(github.user.id).toBe(google.user.id);

    const identities = await getDb()
      .select()
      .from(userIdentities)
      .where(eq(userIdentities.userId, google.user.id));
    expect(identities.map((i) => i.provider).sort()).toEqual(['github', 'google']);
  });

  it('refuses to link when the existing account email is unverified (anti-takeover)', async () => {
    // A pre-existing, never-verified account (e.g. password signup not confirmed).
    await findOrCreateUserByIdentity({
      provider: 'password',
      providerAccountId: 'pw-user',
      email: 'victim@example.com',
      emailVerified: false,
    });

    let thrown: unknown;
    try {
      await findOrCreateUserByIdentity({
        provider: 'github',
        providerAccountId: 'gh-attacker',
        email: 'victim@example.com',
        emailVerified: true,
        name: 'Mallory',
      });
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(409);
    expect((thrown as ApiError).code).toBe('ACCOUNT_EXISTS_DIFFERENT_METHOD');
  });

  it('rejects sign-in for a soft-deleted account', async () => {
    const { user } = await findOrCreateGoogleUser('g-3', 'deleted@example.com', 'Gone');
    await softDeleteUser(user.id);

    let thrown: unknown;
    try {
      await findOrCreateGoogleUser('g-3', 'deleted@example.com', 'Gone');
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(403);
    expect((thrown as ApiError).code).toBe('ACCOUNT_DELETED');
  });
});
