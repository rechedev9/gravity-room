/**
 * Factory helpers for E2E integration tests.
 * Creates real database rows for use in test scenarios.
 */
import { getTestDb } from './db-setup';
import { users, programInstances } from '../src/db/schema';
import { hashPassword } from '../src/services/auth';

export interface TestUser {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly passwordHash: string;
}

let userCounter = 0;

/**
 * Creates a user row in the test database.
 * Each call generates a unique email via an auto-incrementing counter.
 */
export async function createTestUser(overrides?: {
  readonly email?: string;
  readonly password?: string;
  readonly name?: string;
}): Promise<TestUser> {
  userCounter++;
  const email = overrides?.email ?? `testuser${userCounter}@example.com`;
  const password = overrides?.password ?? 'TestPassword123!';
  const passwordHash = await hashPassword(password);

  const [user] = await getTestDb()
    .insert(users)
    .values({ email, passwordHash, name: overrides?.name ?? null })
    .returning();

  if (!user) throw new Error('createTestUser: insert returned no row');

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    passwordHash: user.passwordHash,
  };
}

export interface TestProgram {
  readonly id: string;
  readonly userId: string;
}

/**
 * Creates a program instance row in the test database.
 */
export async function createTestProgram(
  userId: string,
  overrides?: {
    readonly programId?: string;
    readonly name?: string;
    readonly config?: Record<string, number>;
  }
): Promise<TestProgram> {
  const [instance] = await getTestDb()
    .insert(programInstances)
    .values({
      userId,
      programId: overrides?.programId ?? 'gzclp',
      name: overrides?.name ?? 'Test Program',
      config: overrides?.config ?? { squat: 60, bench: 40, deadlift: 60, ohp: 30 },
      status: 'active',
    })
    .returning();

  if (!instance) throw new Error('createTestProgram: insert returned no row');

  return { id: instance.id, userId: instance.userId };
}
