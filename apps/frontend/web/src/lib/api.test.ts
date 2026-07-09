import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  blockAuthRefresh,
  getAccessToken,
  refreshAccessToken,
  resumeAuthRefresh,
  setAccessToken,
} from './api';

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
});
