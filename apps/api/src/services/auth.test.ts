/**
 * Auth service tests — pure functions and DB-error path.
 *
 * The pure function tests (generateRefreshToken, hashToken, REFRESH_TOKEN_DAYS)
 * do not touch the DB. Task 4.12 tests the DB-write-error path of
 * findOrCreateGoogleUser by mocking getDb().
 *
 * mock.module() is hoisted and intercepts any transitively imported DB calls.
 */
process.env['DATABASE_URL'] = 'postgres://test:test@localhost:5432/test';
process.env['LOG_LEVEL'] = 'silent';

import { mock, describe, it, expect } from 'bun:test';

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

// DB query chain: insert().values().onConflictDoUpdate().returning() → [] (empty = failed upsert)
const mockReturning = mock(() => Promise.resolve([] as unknown[]));
const mockOnConflictDoUpdate = mock(() => ({ returning: mockReturning }));
const mockValues = mock(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }));
const mockInsert = mock(() => ({ values: mockValues }));

// select().from().where().limit() — kept for non-upsert select queries
const mockLimit = mock(() => Promise.resolve([] as unknown[]));
const mockWhere = mock(() => ({ limit: mockLimit }));
const mockFrom = mock(() => ({ where: mockWhere }));
const mockSelect = mock(() => ({ from: mockFrom }));

const mockDb = {
  insert: mockInsert,
  select: mockSelect,
};

mock.module('../db', () => ({
  getDb: mock(() => mockDb),
}));

import {
  generateRefreshToken,
  hashToken,
  REFRESH_TOKEN_DAYS,
  findOrCreateGoogleUser,
} from './auth';
import { ApiError } from '../middleware/error-handler';

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

// ---------------------------------------------------------------------------
// 4.12: findOrCreateGoogleUser — DB write error path
// ---------------------------------------------------------------------------

describe('findOrCreateGoogleUser — DB_WRITE_ERROR', () => {
  it('4.12: throws ApiError with code DB_WRITE_ERROR and status 500 when insert returns empty array', async () => {
    // Arrange: mockReturning returns [] → insert produced no row
    mockReturning.mockImplementation(() => Promise.resolve([]));
    mockLimit.mockImplementation(() => Promise.resolve([])); // no existing user

    // Act
    let thrown: unknown;
    try {
      await findOrCreateGoogleUser('google-sub-123', 'user@example.com', 'Test User');
    } catch (e) {
      thrown = e;
    }

    // Assert
    expect(thrown instanceof ApiError).toBe(true);
    expect((thrown as ApiError).code).toBe('DB_WRITE_ERROR');
    expect((thrown as ApiError).statusCode).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// findOrCreateGoogleUser — atomic upsert behavior
// ---------------------------------------------------------------------------

describe('findOrCreateGoogleUser', () => {
  it('inserts and returns a new user on first sign-in', async () => {
    // Arrange: upsert returns a new user row
    const newUser = {
      id: 'user-001',
      googleId: 'G-123',
      email: 'alice@example.com',
      name: 'Alice',
      avatarUrl: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockReturning.mockImplementation(() => Promise.resolve([newUser]));

    // Act
    const result = await findOrCreateGoogleUser('G-123', 'alice@example.com', 'Alice');

    // Assert
    expect(result.id).toBe('user-001');
    expect(result.name).toBe('Alice');
    expect(result.email).toBe('alice@example.com');
    expect(mockInsert).toHaveBeenCalled();
  });

  it('returns existing user with updated name on repeat sign-in', async () => {
    // Arrange: upsert returns existing user with updated name
    const existingUser = {
      id: 'user-002',
      googleId: 'G-123',
      email: 'alice@example.com',
      name: 'Alice Smith',
      avatarUrl: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockReturning.mockImplementation(() => Promise.resolve([existingUser]));

    // Act
    const result = await findOrCreateGoogleUser('G-123', 'alice@example.com', 'Alice Smith');

    // Assert
    expect(result.name).toBe('Alice Smith');
  });

  it('throws ApiError 403 when returned user has deletedAt set', async () => {
    // Arrange: upsert returns a soft-deleted user
    const deletedUser = {
      id: 'user-003',
      googleId: 'G-789',
      email: 'bob@example.com',
      name: 'Bob',
      avatarUrl: null,
      deletedAt: new Date('2026-01-01T00:00:00Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockReturning.mockImplementation(() => Promise.resolve([deletedUser]));

    // Act
    let thrown: unknown;
    try {
      await findOrCreateGoogleUser('G-789', 'bob@example.com', 'Bob');
    } catch (e) {
      thrown = e;
    }

    // Assert
    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).statusCode).toBe(403);
    expect((thrown as ApiError).code).toBe('ACCOUNT_DELETED');
  });

  it('returns successfully when user has deletedAt = null', async () => {
    // Arrange: upsert returns active user
    const activeUser = {
      id: 'user-004',
      googleId: 'G-111',
      email: 'carol@example.com',
      name: 'Carol',
      avatarUrl: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockReturning.mockImplementation(() => Promise.resolve([activeUser]));

    // Act
    const result = await findOrCreateGoogleUser('G-111', 'carol@example.com', 'Carol');

    // Assert
    expect(result.deletedAt).toBeNull();
    expect(result.id).toBe('user-004');
  });

  it('lowercases email before upsert', async () => {
    // Arrange
    mockValues.mockClear();
    const user = {
      id: 'user-005',
      googleId: 'G-222',
      email: 'alice@example.com',
      name: 'Alice',
      avatarUrl: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockReturning.mockImplementation(() => Promise.resolve([user]));

    // Act
    await findOrCreateGoogleUser('G-222', 'Alice@EXAMPLE.COM', 'Alice');

    // Assert — the email passed to values() should be lowercased
    expect(mockValues).toHaveBeenCalled();
    const calls = mockValues.mock.calls as unknown as [Record<string, unknown>][];
    const capturedValues = calls[0]?.[0];
    expect(capturedValues).toBeDefined();
    expect(capturedValues?.email).toBe('alice@example.com');
  });
});
