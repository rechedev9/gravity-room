/**
 * Auth service — refresh token management, user CRUD.
 * Framework-agnostic: no Elysia dependency. JWT signing handled in routes.
 */
import { eq, lt, and, isNull, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { users, refreshTokens } from '@gzclp/database/schema';
import { ApiError } from '../middleware/error-handler';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

type UserRow = typeof users.$inferSelect;

/**
 * Subset of refresh_tokens columns required by the auth flows.
 * Explicit projection keeps the SELECT narrow and decouples callers from
 * future column additions (e.g. user-agent fingerprints) that have no
 * business being shipped on every auth round-trip.
 */
export interface RefreshTokenRow {
  readonly userId: string;
  readonly expiresAt: Date;
  readonly tokenHash: string;
  readonly previousTokenHash: string | null;
}

export type RotateRefreshTokenResult =
  | { readonly status: 'not_found' }
  | { readonly status: 'expired' }
  | { readonly status: 'account_deleted' }
  | {
      readonly status: 'rotated';
      readonly user: UserRow;
      readonly refreshToken: string;
    };

/** Result of findOrCreateGoogleUser — includes new-user detection flag. */
interface FindOrCreateResult {
  readonly user: UserRow;
  readonly isNewUser: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const REFRESH_TOKEN_DAYS = 7;
const REFRESH_TOKEN_MS = REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

export function generateRefreshToken(): string {
  // 32 random bytes (256 bits) hex-encoded. A v4 UUID carries only ~122 bits
  // and a fixed structure; for a 7-day bearer secret prefer full entropy.
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 hash of a token for safe DB storage. */
export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// User operations
// ---------------------------------------------------------------------------

export async function findUserById(id: string): Promise<UserRow | undefined> {
  const [user] = await getDb()
    .select()
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .limit(1);
  return user;
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const [user] = await getDb()
    .select()
    .from(users)
    .where(and(eq(users.email, email.toLowerCase()), isNull(users.deletedAt)))
    .limit(1);
  return user;
}

/**
 * Finds a user by their Google sub claim, creating them if they don't exist.
 * Uses an atomic INSERT ... ON CONFLICT upsert to eliminate the TOCTOU race
 * condition that exists in a SELECT-then-INSERT pattern.
 * Updates name and email on every sign-in via the DO UPDATE clause.
 */
export async function findOrCreateGoogleUser(
  googleId: string,
  email: string,
  name: string | undefined
): Promise<FindOrCreateResult> {
  const db = getDb();

  const [user] = await db
    .insert(users)
    .values({ googleId, email: email.toLowerCase(), name: name ?? null })
    .onConflictDoUpdate({
      target: users.googleId,
      set: {
        name: sql`EXCLUDED.name`,
        email: sql`EXCLUDED.email`,
        updatedAt: new Date(),
      },
      // Never touch a soft-deleted row. Without this guard the DO UPDATE
      // overwrites the email/name of a deleted account on every sign-in
      // attempt, mutating a row the 30-day purge job reasons about.
      setWhere: isNull(users.deletedAt),
    })
    .returning();

  // RETURNING yields no row when the conflict matched a soft-deleted account
  // (the setWhere filtered the UPDATE out). Look it up to return the correct
  // 403 instead of a misleading 500.
  if (!user) {
    const [deleted] = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
    if (deleted?.deletedAt) {
      throw new ApiError(
        403,
        'This account has been deleted. Contact support if you wish to recover it.',
        'ACCOUNT_DELETED'
      );
    }
    throw new ApiError(500, 'Failed to upsert user', 'DB_WRITE_ERROR');
  }

  if (user.deletedAt) {
    throw new ApiError(
      403,
      'This account has been deleted. Contact support if you wish to recover it.',
      'ACCOUNT_DELETED'
    );
  }

  const isNewUser = Math.abs(user.createdAt.getTime() - user.updatedAt.getTime()) < 2_000;
  return { user, isNewUser };
}

/** Update user profile fields (name, avatarUrl). */
export async function updateUserProfile(
  userId: string,
  fields: { name?: string; avatarUrl?: string | null }
): Promise<UserRow> {
  const db = getDb();
  // Value overridden by set_updated_at trigger; kept to ensure valid UPDATE
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (fields.name !== undefined) updates['name'] = fields.name;
  if (fields.avatarUrl !== undefined) updates['avatarUrl'] = fields.avatarUrl;

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .returning();

  if (!updated) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  return updated;
}

/** Soft-delete a user by setting deleted_at and revoking all tokens. */
export async function softDeleteUser(userId: string): Promise<void> {
  const db = getDb();
  const [updated] = await db
    .update(users)
    .set({ deletedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .returning();

  if (!updated) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');

  // Revoke all refresh tokens so the user is immediately logged out everywhere
  await revokeAllUserTokens(userId);
}

// ---------------------------------------------------------------------------
// Refresh token storage
// ---------------------------------------------------------------------------

export async function storeRefreshToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
  previousTokenHash?: string
): Promise<void> {
  await getDb().insert(refreshTokens).values({ userId, tokenHash, expiresAt, previousTokenHash });
}

/**
 * Looks up a refresh token by the hash of the token it replaced.
 * Used for token reuse detection: if an already-rotated token is presented,
 * this finds its successor, revealing the affected userId.
 */
const REFRESH_TOKEN_COLUMNS = {
  userId: refreshTokens.userId,
  expiresAt: refreshTokens.expiresAt,
  tokenHash: refreshTokens.tokenHash,
  previousTokenHash: refreshTokens.previousTokenHash,
} as const;

export async function findRefreshTokenByPreviousHash(
  previousHash: string
): Promise<RefreshTokenRow | undefined> {
  const [token] = await getDb()
    .select(REFRESH_TOKEN_COLUMNS)
    .from(refreshTokens)
    .where(eq(refreshTokens.previousTokenHash, previousHash))
    .limit(1);
  return token;
}

export async function findRefreshToken(tokenHash: string): Promise<RefreshTokenRow | undefined> {
  const [token] = await getDb()
    .select(REFRESH_TOKEN_COLUMNS)
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);
  return token;
}

export async function revokeRefreshToken(tokenHash: string): Promise<void> {
  await getDb().delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await getDb().delete(refreshTokens).where(eq(refreshTokens.userId, userId));
}

/**
 * Atomically consumes one refresh token and writes its successor.
 *
 * The old implementation selected the token, deleted it, then inserted the
 * replacement as separate operations. Two concurrent refresh requests could
 * both observe the old token before either delete happened and each mint a
 * valid successor. This transaction uses DELETE ... RETURNING as the compare-
 * and-swap boundary: only the request that actually deletes the current token
 * may create the next token in the family.
 */
export async function rotateRefreshToken(tokenHash: string): Promise<RotateRefreshTokenResult> {
  return getDb().transaction(async (tx) => {
    const [stored] = await tx
      .delete(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .returning(REFRESH_TOKEN_COLUMNS);

    if (!stored) return { status: 'not_found' };

    if (stored.expiresAt < new Date()) {
      return { status: 'expired' };
    }

    const [user] = await tx
      .select()
      .from(users)
      .where(and(eq(users.id, stored.userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) return { status: 'account_deleted' };

    const refreshToken = generateRefreshToken();
    const newTokenHash = await hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MS);

    await tx.insert(refreshTokens).values({
      userId: stored.userId,
      tokenHash: newTokenHash,
      expiresAt,
      previousTokenHash: tokenHash,
    });

    return { status: 'rotated', user, refreshToken };
  });
}

// ---------------------------------------------------------------------------
// Refresh token lifecycle
// ---------------------------------------------------------------------------

/**
 * Creates a new refresh token, hashes it, stores it, and returns the raw token.
 * Pass `previousHash` when rotating (refresh endpoint) to enable family tracking.
 */
export async function createAndStoreRefreshToken(
  userId: string,
  previousHash?: string
): Promise<string> {
  const refreshToken = generateRefreshToken();
  const tokenHash = await hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MS);
  await storeRefreshToken(userId, tokenHash, expiresAt, previousHash);
  return refreshToken;
}

export async function cleanupExpiredTokens(): Promise<void> {
  await getDb().delete(refreshTokens).where(lt(refreshTokens.expiresAt, new Date()));
}
