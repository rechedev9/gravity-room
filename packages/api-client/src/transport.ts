import { ApiError, parseApiErrorBody } from './api-error.js';
import { buildApiUrl } from './url.js';

export type ApiResponseParser<T> = (body: unknown) => T;
export type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface ApiAuthHooks {
  /** Return the access token currently stored by the application, if any. */
  readonly getAccessToken: () => string | null | Promise<string | null>;
  /** Refresh and persist the session, returning the new access token on success. */
  readonly refreshAccessToken: () => Promise<string | null>;
}

export interface CreateApiTransportOptions {
  readonly baseUrl: string;
  readonly fetch?: ApiFetch;
  readonly auth?: ApiAuthHooks;
}

export type ApiRequestOptions<T> = RequestInit & {
  /** Auth is enabled by default when the transport has auth hooks. */
  readonly authenticated?: boolean;
  /** Validate and transform the untrusted response body at the HTTP boundary. */
  readonly parse: ApiResponseParser<T>;
};

export interface ApiTransport {
  request<T>(path: string, options: ApiRequestOptions<T>): Promise<T>;
}

interface RefreshTransition {
  readonly sourceToken: string | null;
  readonly refreshedToken: string | null;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === '') return null;

  try {
    const body: unknown = JSON.parse(text);
    return body;
  } catch {
    return text;
  }
}

function httpError(response: Response, body: unknown): ApiError {
  const parsed = parseApiErrorBody(body);
  const message =
    parsed.message === 'Unknown error'
      ? `API request failed with status ${response.status}`
      : parsed.message;

  return new ApiError(message, response.status, parsed.code, { body });
}

function sessionChangedError(body: unknown): ApiError {
  return new ApiError(
    'Session changed while the request was in flight',
    401,
    'AUTH_SESSION_CHANGED',
    { body }
  );
}

async function parseSuccess<T>(response: Response, parse: ApiResponseParser<T>): Promise<T> {
  const body = await readResponseBody(response);
  try {
    return parse(body);
  } catch (cause) {
    throw new ApiError(
      'API response did not match the expected contract',
      response.status,
      'INVALID_RESPONSE',
      {
        body,
        cause,
      }
    );
  }
}

/**
 * Create an endpoint-agnostic JSON transport.
 *
 * RequestInit is forwarded to fetch, including AbortSignal. Authenticated 401s
 * are retried once after a shared refresh. Request bodies must therefore be
 * reusable (for example JSON strings or FormData), not one-shot streams.
 */
export function createApiTransport(options: CreateApiTransportOptions): ApiTransport {
  const fetchRequest = options.fetch ?? globalThis.fetch;
  const auth = options.auth;
  const refreshFlights = new Map<string | null, Promise<string | null>>();
  let lastRefresh: RefreshTransition | null = null;

  async function execute(url: string, init: RequestInit, token: string | null): Promise<Response> {
    const headers = new Headers(init.headers);
    if (token !== null) headers.set('Authorization', `Bearer ${token}`);
    return fetchRequest(url, { ...init, headers });
  }

  async function refreshForToken(
    sourceToken: string | null,
    unauthorizedBody: unknown
  ): Promise<string | null> {
    if (auth === undefined) throw sessionChangedError(unauthorizedBody);

    const inFlight = refreshFlights.get(sourceToken);
    if (inFlight !== undefined) return inFlight;

    const currentToken = await auth.getAccessToken();
    if (currentToken !== sourceToken) {
      if (lastRefresh?.sourceToken === sourceToken && lastRefresh.refreshedToken === currentToken) {
        return currentToken;
      }
      throw sessionChangedError(unauthorizedBody);
    }

    const flightAfterTokenRead = refreshFlights.get(sourceToken);
    if (flightAfterTokenRead !== undefined) return flightAfterTokenRead;

    const refresh = (async () => {
      const refreshedToken = await auth.refreshAccessToken();
      if (refreshedToken === null) {
        lastRefresh = { sourceToken, refreshedToken };
        return null;
      }
      const storedToken = await auth.getAccessToken();
      if (storedToken !== refreshedToken) throw sessionChangedError(unauthorizedBody);
      lastRefresh = { sourceToken, refreshedToken };
      return refreshedToken;
    })();
    refreshFlights.set(sourceToken, refresh);

    try {
      return await refresh;
    } finally {
      if (refreshFlights.get(sourceToken) === refresh) refreshFlights.delete(sourceToken);
    }
  }

  return {
    async request<T>(path: string, requestOptions: ApiRequestOptions<T>): Promise<T> {
      const { authenticated, parse, ...init } = requestOptions;
      const useAuth = authenticated ?? auth !== undefined;
      let accessToken: string | null = null;
      if (useAuth) {
        if (auth === undefined) {
          throw new TypeError('Authenticated requests require auth hooks');
        }
        accessToken = await auth.getAccessToken();
      }
      const url = buildApiUrl(options.baseUrl, path);
      const response = await execute(url, init, accessToken);

      if (response.status !== 401 || !useAuth || auth === undefined) {
        const body = await readResponseBody(response);
        if (!response.ok) throw httpError(response, body);
        try {
          return parse(body);
        } catch (cause) {
          throw new ApiError(
            'API response did not match the expected contract',
            response.status,
            'INVALID_RESPONSE',
            { body, cause }
          );
        }
      }

      const unauthorizedBody = await readResponseBody(response);
      const retryToken = await refreshForToken(accessToken, unauthorizedBody);
      if (retryToken === null) throw httpError(response, unauthorizedBody);
      const currentToken = await auth.getAccessToken();
      if (currentToken !== retryToken) throw sessionChangedError(unauthorizedBody);

      const retryResponse = await execute(url, init, retryToken);
      if (!retryResponse.ok) {
        const retryBody = await readResponseBody(retryResponse);
        throw httpError(retryResponse, retryBody);
      }
      return parseSuccess(retryResponse, parse);
    },
  };
}
