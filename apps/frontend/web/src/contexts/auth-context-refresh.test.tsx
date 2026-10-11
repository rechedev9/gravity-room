import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { resumeAuthRefresh, setAccessToken } from '@/lib/api';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { isRecentlySignedOut } from '@/lib/session-hint';

// These cases run the real refresh code against a stubbed fetch: the bugs they
// pin live in how an HTTP status becomes a signed-out state.

type FetchCall = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const USER = { id: 'cookie-user', email: 'cookie@example.com', weightUnit: 'kg' };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sessionResponse(accessToken: string): Response {
  return json(200, { accessToken, user: USER });
}

function noRefreshToken(): Response {
  return json(401, { error: 'No refresh token', code: 'AUTH_NO_REFRESH_TOKEN' });
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return renderHook(() => useAuth(), {
    wrapper: ({ children }: { readonly children: React.ReactNode }) => (
      <QueryClientProvider client={client}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    ),
  });
}

function refreshCalls(fetchMock: ReturnType<typeof vi.fn<FetchCall>>): number {
  return fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/auth/refresh')).length;
}

describe('session restore against the refresh endpoint', () => {
  beforeEach(() => {
    resumeAuthRefresh();
    setAccessToken(null);
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ['a 502', () => json(502, { error: 'Bad gateway' })],
    ['a 429', () => json(429, { error: 'Too many requests', code: 'RATE_LIMITED' })],
    ['a 401 that is not a refresh-token verdict', () => new Response('denied', { status: 401 })],
  ])('retries the refresh on the next load after %s', async (_label, failure) => {
    let respond: () => Response = failure;
    const fetchMock = vi.fn<FetchCall>(() => Promise.resolve(respond()));
    vi.stubGlobal('fetch', fetchMock);

    const first = mount();
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.user).toBeNull();
    expect(isRecentlySignedOut()).toBe(false);
    first.unmount();

    respond = () => sessionResponse('recovered-access');
    const second = mount();
    await waitFor(() => expect(second.result.current.user?.id).toBe('cookie-user'));
    expect(refreshCalls(fetchMock)).toBe(2);
  });

  it('skips the refresh on the next load once the server says there is no session', async () => {
    const fetchMock = vi.fn<FetchCall>(() => Promise.resolve(noRefreshToken()));
    vi.stubGlobal('fetch', fetchMock);

    const first = mount();
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(isRecentlySignedOut()).toBe(true);
    first.unmount();

    const second = mount();
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(second.result.current.user).toBeNull();
    expect(refreshCalls(fetchMock)).toBe(1);
  });
});
