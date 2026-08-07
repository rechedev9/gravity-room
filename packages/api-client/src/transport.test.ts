import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './api-error.js';
import { createApiTransport, type ApiFetch, type ApiResponseParser } from './transport.js';

function parseMessage(body: unknown): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof body.message === 'string'
  ) {
    return body.message;
  }
  throw new Error('Expected message response');
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

describe('createApiTransport', () => {
  it.each([
    {
      name: 'JSON data',
      response: () => jsonResponse({ message: 'ready' }),
      parse: parseMessage,
      expected: 'ready',
    },
    {
      name: 'an empty response',
      response: () => new Response(null, { status: 204 }),
      parse: (body: unknown) => body,
      expected: null,
    },
  ] satisfies ReadonlyArray<{
    name: string;
    response: () => Response;
    parse: ApiResponseParser<unknown>;
    expected: unknown;
  }>)(
    'parses $name through the supplied runtime boundary',
    async ({ response, parse, expected }) => {
      const fetchRequest = vi.fn<ApiFetch>(() => Promise.resolve(response()));
      const transport = createApiTransport({
        baseUrl: 'https://api.example.test/',
        fetch: fetchRequest,
      });

      await expect(transport.request('/health', { parse })).resolves.toEqual(expected);
      expect(fetchRequest).toHaveBeenCalledWith(
        'https://api.example.test/health',
        expect.objectContaining({ headers: expect.any(Headers) })
      );
    }
  );

  it('passes RequestInit and cancellation through to fetch', async () => {
    const fetchRequest = vi.fn<ApiFetch>(() =>
      Promise.resolve(jsonResponse({ message: 'created' }))
    );
    const transport = createApiTransport({ baseUrl: '', fetch: fetchRequest });
    const controller = new AbortController();

    await transport.request('/api/programs', {
      method: 'POST',
      body: '{"name":"Test"}',
      credentials: 'include',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-Request-ID': 'request-1' },
      parse: parseMessage,
    });

    const requestInit = fetchRequest.mock.calls[0]?.[1];
    expect(requestInit).toMatchObject({
      method: 'POST',
      body: '{"name":"Test"}',
      credentials: 'include',
      signal: controller.signal,
    });
    expect(new Headers(requestInit?.headers)).toEqual(
      new Headers({ 'Content-Type': 'application/json', 'X-Request-ID': 'request-1' })
    );
  });

  it.each([
    {
      name: 'structured API error',
      response: () => jsonResponse({ error: 'Not allowed', code: 'FORBIDDEN' }, { status: 403 }),
      message: 'Not allowed [FORBIDDEN]',
      code: 'FORBIDDEN',
      body: { error: 'Not allowed', code: 'FORBIDDEN' },
    },
    {
      name: 'unknown error body',
      response: () => new Response('gateway failure', { status: 502 }),
      message: 'API request failed with status 502',
      code: undefined,
      body: 'gateway failure',
    },
  ])('standardizes $name', async ({ response, message, code, body }) => {
    const transport = createApiTransport({
      baseUrl: 'https://api.example.test',
      fetch: vi.fn<ApiFetch>(() => Promise.resolve(response())),
    });

    const request = transport.request('/resource', { parse: parseMessage });
    await expect(request).rejects.toMatchObject({
      name: 'ApiError',
      message,
      status: response().status,
      code,
      body,
    });
  });

  it('wraps runtime parser failures as invalid API responses with the cause', async () => {
    const parserError = new Error('missing id');
    const transport = createApiTransport({
      baseUrl: '',
      fetch: vi.fn<ApiFetch>(() => Promise.resolve(jsonResponse({ unexpected: true }))),
    });

    const request = transport.request('/api/resource', {
      parse: () => {
        throw parserError;
      },
    });

    await expect(request).rejects.toMatchObject({
      name: 'ApiError',
      status: 200,
      code: 'INVALID_RESPONSE',
      body: { unexpected: true },
      cause: parserError,
    });
  });

  it('attaches the access token and retries once with the refreshed token after a 401', async () => {
    let storedToken = 'expired-token';
    const fetchRequest = vi
      .fn<ApiFetch>()
      .mockResolvedValueOnce(
        jsonResponse({ error: 'Expired', code: 'AUTH_INVALID' }, { status: 401 })
      )
      .mockResolvedValueOnce(jsonResponse({ message: 'authenticated' }));
    const refreshAccessToken = vi.fn(async () => {
      storedToken = 'fresh-token';
      return storedToken;
    });
    const transport = createApiTransport({
      baseUrl: 'https://api.example.test',
      fetch: fetchRequest,
      auth: { getAccessToken: () => storedToken, refreshAccessToken },
    });

    await expect(transport.request('/me', { parse: parseMessage })).resolves.toBe('authenticated');
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(new Headers(fetchRequest.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer expired-token'
    );
    expect(new Headers(fetchRequest.mock.calls[1]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer fresh-token'
    );
  });

  it('shares one refresh across concurrent 401 responses', async () => {
    let storedToken = 'expired-token';
    const refresh = deferred<string | null>();
    const refreshAccessToken = vi.fn(async () => {
      const token = await refresh.promise;
      storedToken = token ?? storedToken;
      return token;
    });
    const fetchRequest = vi.fn<ApiFetch>((_input, init) => {
      const token = new Headers(init?.headers).get('Authorization');
      return Promise.resolve(
        token === 'Bearer fresh-token'
          ? jsonResponse({ message: 'ok' })
          : jsonResponse({ error: 'Expired' }, { status: 401 })
      );
    });
    const transport = createApiTransport({
      baseUrl: '',
      fetch: fetchRequest,
      auth: { getAccessToken: () => storedToken, refreshAccessToken },
    });

    const requests = [
      transport.request('/api/one', { parse: parseMessage }),
      transport.request('/api/two', { parse: parseMessage }),
      transport.request('/api/three', { parse: parseMessage }),
    ];
    await vi.waitFor(() => expect(refreshAccessToken).toHaveBeenCalledTimes(1));
    refresh.resolve('fresh-token');

    await expect(Promise.all(requests)).resolves.toEqual(['ok', 'ok', 'ok']);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchRequest).toHaveBeenCalledTimes(6);
  });

  it('never retries an old-session request with a new session token', async () => {
    let storedToken = 'account-a-token';
    const accountAResponse = deferred<Response>();
    const requests: Array<{ readonly url: string; readonly authorization: string | null }> = [];
    const fetchRequest = vi.fn<ApiFetch>((input, init) => {
      const url = String(input);
      const authorization = new Headers(init?.headers).get('Authorization');
      requests.push({ url, authorization });

      if (url.endsWith('/account-a')) return accountAResponse.promise;
      if (authorization === 'Bearer account-b-token') {
        return Promise.resolve(jsonResponse({ error: 'Expired' }, { status: 401 }));
      }
      return Promise.resolve(jsonResponse({ message: 'account-b-ready' }));
    });
    const refreshAccessToken = vi.fn(async () => {
      storedToken = 'account-b-fresh-token';
      return storedToken;
    });
    const transport = createApiTransport({
      baseUrl: 'https://api.example.test',
      fetch: fetchRequest,
      auth: { getAccessToken: () => storedToken, refreshAccessToken },
    });

    const accountARequest = transport.request('/account-a', { parse: parseMessage });
    await vi.waitFor(() => expect(requests).toHaveLength(1));

    storedToken = 'account-b-token';
    await expect(transport.request('/account-b', { parse: parseMessage })).resolves.toBe(
      'account-b-ready'
    );
    accountAResponse.resolve(jsonResponse({ error: 'Expired' }, { status: 401 }));

    await expect(accountARequest).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'AUTH_SESSION_CHANGED',
    });
    expect(requests.filter(({ url }) => url.endsWith('/account-a'))).toEqual([
      {
        url: 'https://api.example.test/account-a',
        authorization: 'Bearer account-a-token',
      },
    ]);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('returns the original unauthorized error when refresh cannot restore a session', async () => {
    const refreshAccessToken = vi.fn(() => Promise.resolve(null));
    const fetchRequest = vi.fn<ApiFetch>(() =>
      Promise.resolve(
        jsonResponse({ error: 'Session expired', code: 'AUTH_INVALID' }, { status: 401 })
      )
    );
    const transport = createApiTransport({
      baseUrl: '',
      fetch: fetchRequest,
      auth: { getAccessToken: () => 'expired-token', refreshAccessToken },
    });

    await expect(transport.request('/api/me', { parse: parseMessage })).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'AUTH_INVALID',
    });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchRequest).toHaveBeenCalledTimes(1);
  });

  it('does not authenticate or refresh a request that opts out', async () => {
    const getAccessToken = vi.fn(() => 'token');
    const refreshAccessToken = vi.fn(() => Promise.resolve('new-token'));
    const fetchRequest = vi.fn<ApiFetch>(() =>
      Promise.resolve(jsonResponse({ error: 'Unauthorized' }, { status: 401 }))
    );
    const transport = createApiTransport({
      baseUrl: '',
      fetch: fetchRequest,
      auth: { getAccessToken, refreshAccessToken },
    });

    await expect(
      transport.request('/api/public', { authenticated: false, parse: parseMessage })
    ).rejects.toBeInstanceOf(ApiError);
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(new Headers(fetchRequest.mock.calls[0]?.[1]?.headers).has('Authorization')).toBe(false);
  });
});
