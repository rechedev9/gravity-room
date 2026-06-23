/**
 * Auth service — refresh token management, user CRUD.
 * Framework-agnostic: no Elysia dependency. JWT signing handled in routes.
 */
import { eq, lt, and, isNull } from 'drizzle-orm';
import { isRecord } from '@gzclp/domain/type-guards';
import { getDb } from '../db';
import {
  users,
  refreshTokens,
  userIdentities,
  passwordResetTokens,
  emailVerificationTokens,
} from '@gzclp/database/schema';
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

/** Result of findOrCreateUserByIdentity — includes new-user detection flag. */
export interface FindOrCreateResult {
  readonly user: UserRow;
  readonly isNewUser: boolean;
}

/** External auth providers, plus the local email/password method. */
export type AuthProvider = 'google' | 'apple' | 'github' | 'password';

/** Identity descriptor passed to findOrCreateUserByIdentity. */
export interface IdentityInput {
  readonly provider: AuthProvider;
  readonly providerAccountId: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly name?: string | undefined;
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

/** Reusable 403 for sign-in attempts against a soft-deleted account. */
function accountDeletedError(): ApiError {
  return new ApiError(
    403,
    'This account has been deleted. Contact support if you wish to recover it.',
    'ACCOUNT_DELETED'
  );
}

/**
 * True for a PostgreSQL unique-violation (SQLSTATE 23505). Drizzle wraps driver
 * errors in a `DrizzleQueryError` whose `.cause` is the real pg error, so we
 * check both the error itself and its cause.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (!isRecord(error)) return false;
  if (error['code'] === '23505') return true;
  const cause = error['cause'];
  return isRecord(cause) && cause['code'] === '23505';
}

/** What to do with an incoming identity that matches an existing account by email. */
export type IdentityLinkDecision = 'link' | 'conflict' | 'account_deleted';

/**
 * Pure linking policy (no DB). An incoming identity is linked to the existing
 * account only when BOTH the incoming email is provider-verified and the
 * existing account's email is verified — otherwise it is a conflict. This is
 * the anti-takeover guard: an attacker who pre-registers an unverified account
 * for a victim's address must never capture the victim's later social sign-in.
 */
export function decideIdentityLink(
  incomingEmailVerified: boolean,
  existing: { readonly emailVerified: boolean; readonly isDeleted: boolean }
): IdentityLinkDecision {
  if (existing.isDeleted) return 'account_deleted';
  if (incomingEmailVerified && existing.emailVerified) return 'link';
  return 'conflict';
}

/**
 * Resolves the user owning an external identity: returns the existing user,
 * links the identity to a matching verified account, or creates a new
 * user+identity pair. Runs in a transaction so the pair is created atomically.
 *
 * Account linking is intentionally conservative: an incoming identity is only
 * linked to an existing user when BOTH the incoming email is provider-verified
 * and the existing account's email is verified. This blocks the classic
 * email-based takeover where an attacker pre-registers an unverified account
 * for a victim's address and then captures the victim's social sign-in.
 */
async function upsertIdentity(input: IdentityInput): Promise<FindOrCreateResult> {
  const email = input.email.toLowerCase();

  return getDb().transaction(async (tx): Promise<FindOrCreateResult> => {
    // 1. Known identity → return its user (rejecting soft-deleted accounts).
    const [identity] = await tx
      .select({ userId: userIdentities.userId })
      .from(userIdentities)
      .where(
        and(
          eq(userIdentities.provider, input.provider),
          eq(userIdentities.providerAccountId, input.providerAccountId)
        )
      )
      .limit(1);

    if (identity) {
      const [user] = await tx.select().from(users).where(eq(users.id, identity.userId)).limit(1);
      if (!user) throw new ApiError(500, 'Identity references a missing user', 'DB_WRITE_ERROR');
      if (user.deletedAt) throw accountDeletedError();
      return { user, isNewUser: false };
    }

    // 2. No identity yet — link to an existing account by email when safe.
    const [existing] = await tx.select().from(users).where(eq(users.email, email)).limit(1);

    if (existing) {
      const decision = decideIdentityLink(input.emailVerified, {
        emailVerified: existing.emailVerified,
        isDeleted: existing.deletedAt !== null,
      });

      if (decision === 'account_deleted') throw accountDeletedError();
      if (decision === 'conflict') {
        throw new ApiError(
          409,
          'An account with this email already exists. Sign in with your original method.',
          'ACCOUNT_EXISTS_DIFFERENT_METHOD'
        );
      }

      // decision === 'link'
      await tx.insert(userIdentities).values({
        userId: existing.id,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
      });
      return { user: existing, isNewUser: false };
    }

    // 3. Brand-new user. Keep the legacy google_id populated for the Google
    // provider so any read still referencing it works during the transition.
    const [user] = await tx
      .insert(users)
      .values({
        email,
        name: input.name ?? null,
        emailVerified: input.emailVerified,
        googleId: input.provider === 'google' ? input.providerAccountId : null,
      })
      .returning();

    if (!user) throw new ApiError(500, 'Failed to create user', 'DB_WRITE_ERROR');

    await tx.insert(userIdentities).values({
      userId: user.id,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
    });

    return { user, isNewUser: true };
  });
}

/**
 * Finds the user owning an external identity, creating or linking as needed.
 *
 * A concurrent first sign-in can lose the create race (unique violation on the
 * identity or the email). We retry once: on the second attempt the row now
 * exists and is resolved by lookup. See {@link upsertIdentity} for the linking
 * policy.
 */
export async function findOrCreateUserByIdentity(
  input: IdentityInput
): Promise<FindOrCreateResult> {
  try {
    return await upsertIdentity(input);
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return upsertIdentity(input);
    }
    throw error;
  }
}

/**
 * Google-specific wrapper kept for the /auth/google routes. Google verifies
 * email ownership, so emailVerified is always true.
 */
export async function findOrCreateGoogleUser(
  googleId: string,
  email: string,
  name: string | undefined
): Promise<FindOrCreateResult> {
  return findOrCreateUserByIdentity({
    provider: 'google',
    providerAccountId: googleId,
    email,
    emailVerified: true,
    name,
  });
}

// ---------------------------------------------------------------------------
// Email / password method
// ---------------------------------------------------------------------------

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Hashes a plaintext password with argon2id (native to Bun — no dependency). */
export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: 'argon2id' });
}

/** Verifies a plaintext password against a stored argon2id/bcrypt hash. */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(password, hash);
  } catch {
    return false;
  }
}

// A dummy hash computed once so authenticatePassword spends comparable time
// whether or not the email exists — closes a timing-based user-enumeration oracle.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  return (dummyHashPromise ??= hashPassword('timing-equalization-placeholder'));
}

/**
 * Verifies an email+password login. Returns the user on success, null on bad
 * credentials. Always runs one hash verification (against a dummy hash when the
 * account or its password is missing) to equalize timing and avoid enumeration.
 */
export async function authenticatePassword(
  email: string,
  password: string
): Promise<UserRow | null> {
  const user = await findUserByEmail(email);
  const hash = user?.passwordHash ?? (await getDummyHash());
  const ok = await verifyPassword(password, hash);
  if (!user || !user.passwordHash || !ok) return null;
  return user;
}

/**
 * Creates a new email/password user plus its 'password' identity (account id =
 * the user id). Throws 409 EMAIL_TAKEN when the email already exists.
 */
export async function createPasswordUser(input: {
  email: string;
  passwordHash: string;
  name?: string | undefined;
}): Promise<UserRow> {
  const email = input.email.toLowerCase();
  try {
    return await getDb().transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email,
          name: input.name ?? null,
          passwordHash: input.passwordHash,
          emailVerified: false,
        })
        .returning();
      if (!user) throw new ApiError(500, 'Failed to create user', 'DB_WRITE_ERROR');
      await tx
        .insert(userIdentities)
        .values({ userId: user.id, provider: 'password', providerAccountId: user.id });
      return user;
    });
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      throw new ApiError(409, 'An account with this email already exists', 'EMAIL_TAKEN');
    }
    throw error;
  }
}

/** Sets or replaces a user's password hash. */
export async function setUserPassword(userId: string, passwordHash: string): Promise<void> {
  const [updated] = await getDb()
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .returning({ id: users.id });
  if (!updated) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
}

/** Marks a user's email as verified. Returns the updated row, or undefined if absent. */
export async function markEmailVerified(userId: string): Promise<UserRow | undefined> {
  const [updated] = await getDb()
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .returning();
  return updated;
}

// Single-use tokens (SHA-256 hashed at rest, like refresh tokens) ------------

export async function createEmailVerificationToken(userId: string): Promise<string> {
  const token = generateRefreshToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
  await getDb().insert(emailVerificationTokens).values({ userId, tokenHash, expiresAt });
  return token;
}

/** Consumes a verification token; returns its userId if valid & unexpired, else null. */
export async function consumeEmailVerificationToken(token: string): Promise<string | null> {
  const tokenHash = await hashToken(token);
  const [row] = await getDb()
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.tokenHash, tokenHash))
    .returning();
  if (!row || row.expiresAt < new Date()) return null;
  return row.userId;
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = generateRefreshToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  await getDb().insert(passwordResetTokens).values({ userId, tokenHash, expiresAt });
  return token;
}

/** Consumes a reset token; returns its userId if valid & unexpired, else null. */
export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const tokenHash = await hashToken(token);
  const [row] = await getDb()
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .returning();
  if (!row || row.expiresAt < new Date()) return null;
  return row.userId;
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

  // Revoke all refresh tokens so no new access tokens can be minted. Any access
  // token already issued stays valid until it expires (~15 min) — the
  // resource-route guard validates JWTs statelessly and does not check deletedAt.
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
