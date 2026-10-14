import { API_URL, getAccessToken, refreshAccessToken } from './api';
import { parseUser } from '@gzclp/domain/schemas/user';
import type { UserInfo } from '@gzclp/domain/schemas/user';
import type { WeightUnit } from '@gzclp/domain/weight-unit';
import { mergeHeaders } from '@gzclp/api-client/merge-headers';
import { readApiError } from '@gzclp/api-client/response-error';


export interface ApiFetchOptions extends RequestInit {
  /**
   * When false, a 401 is thrown directly instead of attempting a token refresh
   * and retry. Set it for unauthenticated endpoints (login, signup, password
   * reset) where there is no session to refresh, so an invalid-credentials 401
   * does not waste a refresh round-trip and log a misleading auth error.
   */
  readonly retryAuth?: boolean;
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<unknown> {
  const { retryAuth = true, ...init } = options;
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const doFetch = (): Promise<Response> =>
    fetch(`${API_URL}/api${path}`, {
      ...init,
      headers: mergeHeaders(headers, init.headers),
      credentials: 'include',
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(30_000)])
        : AbortSignal.timeout(30_000),
    });

  const res = await doFetch();

  if (res.status === 401) {
    const refreshed = retryAuth ? await refreshAccessToken() : null;
    if (!refreshed) throw await readApiError(res, 'Authentication failed');

    headers['Authorization'] = `Bearer ${refreshed.accessToken}`;
    const retry = await doFetch();
    if (!retry.ok) throw await readApiError(retry, `API error: ${retry.status}`);
    if (retry.status === 204) return null;
    return retry.json();
  }

  if (!res.ok) throw await readApiError(res, `API error: ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}


/** Fetch the authenticated user's profile. */
export async function fetchMe(): Promise<UserInfo> {
  const data = await apiFetch('/auth/me');
  return parseUser(data);
}

/** Update user profile (name, avatar and/or weight unit). */
export async function updateProfile(fields: {
  name?: string;
  avatarUrl?: string | null;
  weightUnit?: WeightUnit;
}): Promise<UserInfo> {
  const data = await apiFetch('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
  return parseUser(data);
}

/** Soft-delete the current user account. */
export async function deleteAccount(): Promise<void> {
  await apiFetch('/auth/me', { method: 'DELETE' });
}
