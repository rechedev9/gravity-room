import type { Page } from '@playwright/test';
import { DEFAULT_WEIGHTS } from './fixtures';

const BASE_URL = process.env['E2E_API_URL'] ?? 'http://localhost:3001';

// GZCLP slot map (mirrors GZCLP_DEFINITION.days — stable, defined in gzclp.ts)
const SLOT_MAP: Record<number, Record<string, string>> = {
  0: { t1: 'd1-t1', t2: 'd1-t2', t3: 'd1-t3' },
  1: { t1: 'd2-t1', t2: 'd2-t2', t3: 'd2-t3' },
  2: { t1: 'd3-t1', t2: 'd3-t2', t3: 'd3-t3' },
  3: { t1: 'd4-t1', t2: 'd4-t2', t3: 'd4-t3' },
};

function tierToSlotId(workoutIndex: number, tier: string): string | null {
  return SLOT_MAP[workoutIndex % 4]?.[tier] ?? null;
}

interface AuthResult {
  readonly email: string;
  readonly accessToken: string;
}

/**
 * Creates a unique test user via the dev-only /auth/dev endpoint and signs in.
 * page.request shares cookies with the browser context, so the refresh_token
 * httpOnly cookie is automatically available for subsequent page navigations.
 *
 * The /auth/dev endpoint is only active in non-production environments and
 * returns 404 in production, making it safe to include in the API.
 */
export async function createAndAuthUser(page: Page): Promise<AuthResult> {
  const email = `e2e-${crypto.randomUUID()}@test.local`;

  const res = await page.request.post(`${BASE_URL}/auth/dev`, {
    data: { email },
  });
  if (!res.ok()) throw new Error(`Dev sign-in failed: ${res.status()} ${await res.text()}`);

  const body = (await res.json()) as { accessToken: string };
  return { email, accessToken: body.accessToken };
}

/**
 * Creates a GZCLP program via the API. Returns the program instance ID.
 */
export async function createTestProgram(
  page: Page,
  accessToken: string,
  weights: typeof DEFAULT_WEIGHTS = DEFAULT_WEIGHTS
): Promise<string> {
  const res = await page.request.post(`${BASE_URL}/programs`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { programId: 'gzclp', name: 'Test Program', config: weights },
  });
  if (!res.ok()) throw new Error(`Create program failed: ${res.status()}`);
  const body = (await res.json()) as { id: string };
  return body.id;
}

/**
 * Seeds tier-keyed results into a program via the API.
 * Converts tier keys (t1/t2/t3) → slotIds at this boundary.
 */
export async function seedResultsViaAPI(
  page: Page,
  accessToken: string,
  programId: string,
  results: Record<string, Record<string, string>>
): Promise<void> {
  for (const [indexStr, tierResults] of Object.entries(results)) {
    const workoutIndex = Number(indexStr);
    for (const [tier, result] of Object.entries(tierResults)) {
      const slotId = tierToSlotId(workoutIndex, tier);
      if (!slotId) continue;
      await page.request.post(`${BASE_URL}/programs/${programId}/results`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { workoutIndex, slotId, result },
      });
    }
  }
}
