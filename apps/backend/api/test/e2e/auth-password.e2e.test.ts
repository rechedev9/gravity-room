/**
 * Integration tests for the email/password method against a real Postgres.
 * Run with: DATABASE_URL_TEST=... pnpm --filter api test:e2e
 *
 * Covers the DB-backed flows the mocked unit suite can't reach: argon2 hashing
 * round-trips through the DB, single-use token create/consume, the EMAIL_TAKEN
 * guard, and the timing-equalized authenticate path.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  users,
  userIdentities,
  emailVerificationTokens,
  passwordResetTokens,
} from '@gzclp/database/schema';
import { setupTestDb, teardownTestDb, truncateAllTables } from '../db-setup';
import {
  hashPassword,
  createPasswordUser,
  authenticatePassword,
  setUserPassword,
  markEmailVerified,
  createEmailVerificationToken,
  replaceEmailVerificationToken,
  consumeEmailVerificationToken,
  createPasswordResetToken,
  consumePasswordResetToken,
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

describe('email/password (integration)', () => {
  it('creates a password user (hashed, unverified, no google_id) plus a password identity', async () => {
    const user = await createPasswordUser({
      email: 'Morpheus@Example.com',
      passwordHash: await hashPassword('redpill-123'),
    });

    expect(user.email).toBe('morpheus@example.com');
    expect(user.emailVerified).toBe(false);
    expect(user.googleId).toBeNull();
    expect(user.passwordHash).not.toBeNull();
    expect(user.passwordHash).not.toBe('redpill-123');

    const identities = await getDb()
      .select()
      .from(userIdentities)
      .where(eq(userIdentities.userId, user.id));
    expect(identities).toHaveLength(1);
    expect(identities[0]?.provider).toBe('password');
    expect(identities[0]?.providerAccountId).toBe(user.id);
  });

  it('rejects a duplicate email with 409 EMAIL_TAKEN and creates no second user', async () => {
    await createPasswordUser({
      email: 'dup@example.com',
      passwordHash: await hashPassword('pw-123456'),
    });

    let thrown: unknown;
    try {
      await createPasswordUser({
        email: 'dup@example.com',
        passwordHash: await hashPassword('other-123'),
      });
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(409);
    expect((thrown as ApiError).code).toBe('EMAIL_TAKEN');

    const allUsers = await getDb().select().from(users);
    expect(allUsers).toHaveLength(1);
  });

  it('authenticatePassword returns the user for correct credentials, null otherwise', async () => {
    const created = await createPasswordUser({
      email: 'auth@example.com',
      passwordHash: await hashPassword('s3cret-pw-1'),
    });

    expect((await authenticatePassword('auth@example.com', 's3cret-pw-1'))?.id).toBe(created.id);
    expect(await authenticatePassword('auth@example.com', 'wrong-pw')).toBeNull();
    expect(await authenticatePassword('nobody@example.com', 's3cret-pw-1')).toBeNull();
    // Email lookup is case-insensitive.
    expect((await authenticatePassword('AUTH@example.com', 's3cret-pw-1'))?.id).toBe(created.id);
  });

  it('verifies email via a single-use token and flips the verified flag', async () => {
    const user = await createPasswordUser({
      email: 'verify@example.com',
      passwordHash: await hashPassword('pw-verify-1'),
    });
    expect(user.emailVerified).toBe(false);

    const token = await createEmailVerificationToken(user.id);
    expect(await consumeEmailVerificationToken(token)).toBe(user.id);
    // Single-use: a second consume returns null.
    expect(await consumeEmailVerificationToken(token)).toBeNull();

    const updated = await markEmailVerified(user.id);
    expect(updated?.emailVerified).toBe(true);

    const rows = await getDb()
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.id));
    expect(rows).toHaveLength(0);
  });

  it('replaceEmailVerificationToken invalidates every earlier verification link', async () => {
    const user = await createPasswordUser({
      email: 'resend@example.com',
      passwordHash: await hashPassword('pw-resend-1'),
    });

    // First link (as sent by signup), then a resend that must supersede it.
    const firstToken = await createEmailVerificationToken(user.id);
    const secondToken = await replaceEmailVerificationToken(user.id);

    expect(secondToken).not.toBe(firstToken);

    // Exactly one token row survives - the replacement deleted the prior one.
    const rows = await getDb()
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.id));
    expect(rows).toHaveLength(1);

    // The old link no longer verifies; only the latest one does.
    expect(await consumeEmailVerificationToken(firstToken)).toBeNull();
    expect(await consumeEmailVerificationToken(secondToken)).toBe(user.id);
  });

  it('resets the password via a single-use token, invalidating the old password', async () => {
    const user = await createPasswordUser({
      email: 'reset@example.com',
      passwordHash: await hashPassword('old-password-1'),
    });

    const token = await createPasswordResetToken(user.id);
    expect(await consumePasswordResetToken(token)).toBe(user.id);
    expect(await consumePasswordResetToken(token)).toBeNull(); // single-use

    await setUserPassword(user.id, await hashPassword('new-password-2'));

    expect(await authenticatePassword('reset@example.com', 'old-password-1')).toBeNull();
    expect((await authenticatePassword('reset@example.com', 'new-password-2'))?.id).toBe(user.id);

    const rows = await getDb()
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));
    expect(rows).toHaveLength(0);
  });
});
