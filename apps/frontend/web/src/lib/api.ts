/**
 * Access token management and refresh logic.
 *
 * The access token is stored in-memory (module-level variable) — never in
 * localStorage. api-functions.ts injects it on every outgoing request.
 *
 * Token refresh uses createSingleFlight: if multiple requests fail with 401
 * simultaneously, only one refresh attempt runs — the others wait for its result.
 */
import { isRecord } from '@gzclp/domain/type-guards';
import { createSingleFlight } from '@gzclp/api-client/single-flight';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// ---------------------------------------------------------------------------
// In-memory access token
// ---------------------------------------------------------------------------

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export async function clearApiResponseCache(): Promise<void> {
  if (!('caches' in globalThis)) return;
  await globalThis.caches.delete('api-cache');
}

// ---------------------------------------------------------------------------
// Refresh mutex — ensures only one refresh runs at a time
// ---------------------------------------------------------------------------

const refreshAccessToken = createSingleFlight(async (): Promise<string | null> => {
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!res.ok) {
    setAccessToken(null);
    await clearApiResponseCache();
    return null;
  }

  const body: unknown = await res.json();
  if (isRecord(body) && typeof body.accessToken === 'string') {
    setAccessToken(body.accessToken);
    return body.accessToken;
  }

  setAccessToken(null);
  await clearApiResponseCache();
  return null;
});

export { refreshAccessToken };
