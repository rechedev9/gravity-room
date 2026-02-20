/**
 * Auth service — password hashing, refresh token management, user CRUD.
 * Framework-agnostic: no Elysia dependency. JWT signing handled in routes.
 */
import { eq, lt, and, gt, isNull } from 'drizzle-orm';
import { getDb } from '../db';
import { users, refreshTokens, passwordResetTokens } from '../db/schema';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type UserRow = typeof users.$inferSelect;
export type RefreshTokenRow = typeof refreshTokens.$inferSelect;
export type PasswordResetTokenRow = typeof passwordResetTokens.$inferSelect;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const REFRESH_TOKEN_DAYS = 7;
const REFRESH_TOKEN_MS = REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Password hashing (Bun built-in Argon2id)
// ---------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, 'argon2id');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

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

export async function createUser(
  email: string,
  passwordHash: string,
  name?: string
): Promise<UserRow> {
  const normalizedEmail = email.trim().toLowerCase();
  const [user] = await getDb()
    .insert(users)
    .values({ email: normalizedEmail, passwordHash, name: name ?? null })
    .returning();

  if (!user) {
    throw new Error('Failed to create user');
  }
  return user;
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const normalizedEmail = email.trim().toLowerCase();
  const [user] = await getDb()
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);
  return user;
}

export async function findUserById(id: string): Promise<UserRow | undefined> {
  const [user] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  return user;
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

export async function cleanupExpiredPasswordResetTokens(): Promise<void> {
  await getDb().delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, new Date()));
}

// ---------------------------------------------------------------------------
// Password reset tokens
// ---------------------------------------------------------------------------

/** Creates a password reset token, stores the hash, and returns the raw token. */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const rawToken = crypto.randomUUID();
  const tokenHash = await hashToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);
  await getDb().insert(passwordResetTokens).values({ userId, tokenHash, expiresAt });
  return rawToken;
}

/** Finds a valid (unused, not expired) password reset token by hash. */
export async function findPasswordResetToken(
  tokenHash: string
): Promise<PasswordResetTokenRow | undefined> {
  const now = new Date();
  const [token] = await getDb()
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        gt(passwordResetTokens.expiresAt, now),
        isNull(passwordResetTokens.usedAt)
      )
    )
    .limit(1);
  return token;
}

/**
 * Atomically marks the reset token as used, updates the user's password,
 * and revokes all active sessions — wrapped in a transaction so partial
 * failures cannot leave the account in an inconsistent state.
 */
export async function markPasswordResetTokenUsed(
  tokenHash: string,
  newPassword: string
): Promise<void> {
  const newHash = await hashPassword(newPassword);
  const now = new Date();

  await getDb().transaction(async (tx) => {
    const [token] = await tx
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);

    if (!token) return;

    await Promise.all([
      tx
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(eq(passwordResetTokens.tokenHash, tokenHash)),
      tx
        .update(users)
        .set({ passwordHash: newHash, updatedAt: now })
        .where(eq(users.id, token.userId)),
      tx.delete(refreshTokens).where(eq(refreshTokens.userId, token.userId)),
    ]);
  });
}
