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
import { ApiError } from '@gzclp/api-client/api-error';
import { readApiError } from '@gzclp/api-client/response-error';
import { createSingleFlight } from '@gzclp/api-client/single-flight';
import { SESSION_INVALIDATED_EVENT } from './auth-events';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

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
 *
 * `null` means the server confirmed there is no session. Any other failure
 * (network, 429, 5xx) throws and leaves the token and the session untouched.
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
    const error = await readApiError(res, 'Session refresh failed');
    // 429, 5xx and a 401 from anything but the endpoint itself say nothing about the cookie.
    if (!isRefreshTokenVerdict(error)) throw error;
    setAccessToken(null);
    await clearApiResponseCache();
    globalThis.dispatchEvent(new Event(SESSION_INVALIDATED_EVENT));
    return null;
  }

  const body: unknown = await res.json();
  if (isRecord(body) && typeof body.accessToken === 'string') {
    setAccessToken(body.accessToken);
    return { accessToken: body.accessToken, user: body.user };
  }

  throw new ApiError('Unexpected refresh response', res.status);
});

/** True only for the refresh endpoint's own 401s (AUTH_NO_REFRESH_TOKEN, AUTH_INVALID_REFRESH...). */
function isRefreshTokenVerdict(error: ApiError): boolean {
  return error.status === 401 && error.code !== undefined && error.code.startsWith('AUTH_');
}

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
