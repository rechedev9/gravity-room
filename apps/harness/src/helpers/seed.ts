import { createClient, type HarnessClient } from './client';

export interface SeededUser {
  readonly email: string;
  readonly userId: string;
  readonly accessToken: string;
  readonly client: HarnessClient;
}

/** Default starting weights matching apps/web/e2e/helpers/fixtures.ts DEFAULT_WEIGHTS. */
export const DEFAULT_WEIGHTS = {
  squat: 60,
  bench: 40,
  deadlift: 60,
  ohp: 30,
  latpulldown: 30,
  dbrow: 12.5,
};

/**
 * Creates a unique test user via POST /api/auth/dev.
 * Returns a SeededUser with client whose cookie jar already has the refresh_token.
 */
export async function seedUser(): Promise<SeededUser> {
  const client = createClient();
  const email = `harness-${crypto.randomUUID()}@test.local`;

  const res = await client.post('/api/auth/dev', { email });
  if (!res.ok) {
    throw new Error(`seedUser failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as { user: { id: string }; accessToken: string };
  return {
    email,
    userId: body.user.id,
    accessToken: body.accessToken,
    client,
  };
}

/**
 * Creates a GZCLP program instance via POST /api/programs.
 * Returns the program instance ID.
 */
export async function createTestProgram(
  accessToken: string,
  client: HarnessClient
): Promise<string> {
  const res = await client.post(
    '/api/programs',
    { programId: 'gzclp', name: 'Harness Test', config: DEFAULT_WEIGHTS },
    { accessToken }
  );
  if (!res.ok) {
    throw new Error(`createTestProgram failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { id: string };
  return body.id;
}

/**
 * Submits a workout result via POST /api/programs/:id/results.
 * Returns the raw Response for tests that need to inspect it.
 */
export async function seedResult(
  client: HarnessClient,
  accessToken: string,
  programId: string,
  workoutIndex: number,
  slotId: string,
  result: string,
  extras?: { amrapReps?: number; rpe?: number; setLogs?: unknown[] }
): Promise<Response> {
  return client.post(
    `/api/programs/${programId}/results`,
    { workoutIndex, slotId, result, ...extras },
    { accessToken }
  );
}
