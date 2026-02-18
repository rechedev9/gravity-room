/**
 * Access token management and refresh logic.
 *
 * The access token is stored in-memory (module-level variable) — never in
 * localStorage. api-functions.ts injects it on every outgoing request.
 *
 * Token refresh is handled with a promise-based mutex: if multiple requests
 * fail with 401 simultaneously, only one refresh attempt runs — the others
 * wait for its result.
 */
import { isRecord } from '@gzclp/shared/type-guards';

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

// ---------------------------------------------------------------------------
// Refresh mutex — ensures only one refresh runs at a time
// ---------------------------------------------------------------------------

let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!res.ok) {
    setAccessToken(null);
    return null;
  }

  const body: unknown = await res.json();
  if (isRecord(body) && typeof body.accessToken === 'string') {
    setAccessToken(body.accessToken);
    return body.accessToken;
  }

  setAccessToken(null);
  return null;
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = doRefresh().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}
