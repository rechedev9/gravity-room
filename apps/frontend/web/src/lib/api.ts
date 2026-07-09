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
let refreshBlocked = false;
let activeRefreshController: AbortController | null = null;

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

/**
 * Refresh result. `user` is the raw profile payload the endpoint now returns
 * alongside the token — callers that need a session (restoreSession) parse it,
 * letting them skip a follow-up GET /auth/me. The 401-retry path ignores it.
 */
export interface RefreshResult {
  readonly accessToken: string;
  readonly user: unknown;
}

const refreshAccessToken = createSingleFlight(async (): Promise<RefreshResult | null> => {
  if (refreshBlocked) return null;

  const controller = new AbortController();
  activeRefreshController = controller;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
    });
  } catch (err: unknown) {
    if (refreshBlocked && controller.signal.aborted) return null;
    throw err;
  } finally {
    if (activeRefreshController === controller) activeRefreshController = null;
  }

  if (refreshBlocked) return null;

  if (!res.ok) {
    setAccessToken(null);
    await clearApiResponseCache();
    return null;
  }

  const body: unknown = await res.json();
  if (isRecord(body) && typeof body.accessToken === 'string') {
    setAccessToken(body.accessToken);
    return { accessToken: body.accessToken, user: body.user };
  }

  setAccessToken(null);
  await clearApiResponseCache();
  return null;
});

/**
 * Prevent refresh-token rotation while logout is in progress. Any active
 * request is aborted and later refresh attempts stay blocked until the caller
 * explicitly resumes them (only needed when logout fails).
 */
export function blockAuthRefresh(): void {
  refreshBlocked = true;
  activeRefreshController?.abort();
  activeRefreshController = null;
}

export function resumeAuthRefresh(): void {
  refreshBlocked = false;
}

export { refreshAccessToken };
