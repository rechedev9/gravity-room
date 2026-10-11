import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  blockAuthRefresh,
  getAccessToken,
  refreshAccessToken,
  resumeAuthRefresh,
  setAccessToken,
} from './api';
import { SESSION_INVALIDATED_EVENT } from './auth-events';

type FetchCall = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

describe('auth refresh lifecycle', () => {
  beforeEach(() => {
    resumeAuthRefresh();
    setAccessToken(null);
  });

  afterEach(() => {
    resumeAuthRefresh();
    vi.unstubAllGlobals();
  });

  it('blocks new refreshes during logout and can resume after a failed logout', async () => {
    const fetchMock = vi.fn<FetchCall>(() =>
      Promise.resolve(
        new Response(JSON.stringify({ accessToken: 'new-access-token', user: { id: 'user-1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    blockAuthRefresh();
    await expect(refreshAccessToken()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    resumeAuthRefresh();
    await expect(refreshAccessToken()).resolves.toEqual({
      accessToken: 'new-access-token',
      user: { id: 'user-1' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBe('new-access-token');
  });

  it('aborts an in-flight refresh when logout starts', async () => {
    const fetchMock = vi.fn<FetchCall>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            reject(new Error('Expected an abort signal'));
            return;
          }
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('The operation was aborted', 'AbortError')),
            { once: true }
          );
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const pendingRefresh = refreshAccessToken();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    blockAuthRefresh();

    await expect(pendingRefresh).resolves.toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it('notifies the auth owner when a refresh token is rejected', async () => {
    const onAuthFailure = vi.fn();
    window.addEventListener(SESSION_INVALIDATED_EVENT, onAuthFailure, { once: true });
    vi.stubGlobal(
      'fetch',
      vi.fn<FetchCall>(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ error: 'Invalid refresh token', code: 'AUTH_INVALID_REFRESH' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          )
        )
      )
    );
    setAccessToken('expired-access');

    await expect(refreshAccessToken()).resolves.toBeNull();

    expect(onAuthFailure).toHaveBeenCalledOnce();
    expect(getAccessToken()).toBeNull();
  });

  it.each([429, 500, 503])(
    'keeps the session when the refresh endpoint answers %i',
    async (status) => {
      const onAuthFailure = vi.fn();
      window.addEventListener(SESSION_INVALIDATED_EVENT, onAuthFailure);
      vi.stubGlobal(
        'fetch',
        vi.fn<FetchCall>(() => Promise.resolve(new Response('unavailable', { status })))
      );
      setAccessToken('current-access');

      await expect(refreshAccessToken()).rejects.toMatchObject({ status });

      window.removeEventListener(SESSION_INVALIDATED_EVENT, onAuthFailure);
      expect(onAuthFailure).not.toHaveBeenCalled();
      expect(getAccessToken()).toBe('current-access');
    }
  );
});
