import { ApiError } from '@gzclp/api-client/api-error';

import { mobileApiTransport } from './transport';

const mockGetAccessToken = jest.fn<string | null, []>();
const mockRefreshAccessTokenForRequest = jest.fn<Promise<string | null>, []>();
const mockFetch = jest.fn<Promise<Response>, [input: RequestInfo | URL, init?: RequestInit]>();

jest.mock('../auth/session', () => ({
  buildApiUrl: (path: string) => `http://localhost:3001/api${path}`,
  getAccessToken: () => mockGetAccessToken(),
  refreshAccessTokenForRequest: () => mockRefreshAccessTokenForRequest(),
}));

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

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

describe('mobileApiTransport', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    mockFetch.mockReset();
    mockGetAccessToken.mockReset();
    mockRefreshAccessTokenForRequest.mockReset();
    globalThis.fetch = originalFetch;
  });

  it('uses the mobile API prefix and current access token', async () => {
    mockGetAccessToken.mockReturnValue('mobile-access-token');
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'ready' }));

    await expect(mobileApiTransport.request('/programs', { parse: parseMessage })).resolves.toBe(
      'ready'
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/programs',
      expect.objectContaining({ headers: expect.any(Headers) })
    );
    expect(new Headers(mockFetch.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer mobile-access-token'
    );
  });

  it('refreshes once and retries an authenticated request with the replacement token', async () => {
    let storedToken = 'expired-access-token';
    mockGetAccessToken.mockImplementation(() => storedToken);
    mockRefreshAccessTokenForRequest.mockImplementation(async () => {
      storedToken = 'fresh-access-token';
      return storedToken;
    });
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({ error: 'Expired', code: 'AUTH_INVALID' }, { status: 401 })
      )
      .mockResolvedValueOnce(jsonResponse({ message: 'restored' }));

    await expect(
      mobileApiTransport.request('/programs/instance-1', { parse: parseMessage })
    ).resolves.toBe('restored');

    expect(mockRefreshAccessTokenForRequest).toHaveBeenCalledTimes(1);
    expect(new Headers(mockFetch.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer expired-access-token'
    );
    expect(new Headers(mockFetch.mock.calls[1]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer fresh-access-token'
    );
  });

  it('does not read or refresh auth when a public catalog request returns 401', async () => {
    mockGetAccessToken.mockReturnValue('mobile-access-token');
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: 'Unauthorized', code: 'AUTH_INVALID' }, { status: 401 })
    );

    await expect(
      mobileApiTransport.request('/catalog/gzclp', {
        authenticated: false,
        parse: parseMessage,
      })
    ).rejects.toMatchObject({
      status: 401,
      code: 'AUTH_INVALID',
    });

    expect(mockGetAccessToken).not.toHaveBeenCalled();
    expect(mockRefreshAccessTokenForRequest).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(new Headers(mockFetch.mock.calls[0]?.[1]?.headers).has('Authorization')).toBe(false);
  });

  it.each([
    {
      name: 'a structured API error',
      response: () => jsonResponse({ error: 'Not allowed', code: 'FORBIDDEN' }, { status: 403 }),
      expected: { status: 403, code: 'FORBIDDEN', message: 'Not allowed [FORBIDDEN]' },
    },
    {
      name: 'a non-JSON gateway error',
      response: () => new Response('gateway failure', { status: 502 }),
      expected: {
        status: 502,
        code: undefined,
        message: 'API request failed with status 502',
      },
    },
  ])('normalizes $name', async ({ response, expected }) => {
    mockFetch.mockResolvedValueOnce(response());

    await expect(
      mobileApiTransport.request('/catalog', {
        authenticated: false,
        parse: parseMessage,
      })
    ).rejects.toMatchObject(expected);
  });

  it.each([
    { name: 'an object without a message', body: { unexpected: true } },
    { name: 'an array', body: [] },
    { name: 'null', body: null },
  ])('rejects $name when the endpoint parser cannot validate it', async ({ body }) => {
    mockFetch.mockResolvedValueOnce(jsonResponse(body));

    const request = mobileApiTransport.request('/catalog', {
      authenticated: false,
      parse: parseMessage,
    });

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({
      status: 200,
      code: 'INVALID_RESPONSE',
      body,
    });
  });
});
