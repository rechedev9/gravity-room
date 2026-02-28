/**
 * Auth service — refresh token management, user CRUD.
 * Framework-agnostic: no Elysia dependency. JWT signing handled in routes.
 */
import { eq, lt, and, isNull, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { users, refreshTokens } from '../db/schema';
import { ApiError } from '../middleware/error-handler';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type UserRow = typeof users.$inferSelect;
export type RefreshTokenRow = typeof refreshTokens.$inferSelect;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const REFRESH_TOKEN_DAYS = 7;
const REFRESH_TOKEN_MS = REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

export function generateRefreshToken(): string {
  return crypto.randomUUID();
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
): Promise<UserRow> {
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
    })
    .returning();

  if (!user) throw new ApiError(500, 'Failed to upsert user', 'DB_WRITE_ERROR');

  if (user.deletedAt) {
    throw new ApiError(
      403,
      'Esta cuenta ha sido eliminada. Contacta con soporte si deseas recuperarla.',
      'ACCOUNT_DELETED'
    );
  }

  return user;
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
export async function findRefreshTokenByPreviousHash(
  previousHash: string
): Promise<RefreshTokenRow | undefined> {
  const [token] = await getDb()
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.previousTokenHash, previousHash))
    .limit(1);
  return token;
}

export async function findRefreshToken(tokenHash: string): Promise<RefreshTokenRow | undefined> {
  const [token] = await getDb()
    .select()
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
