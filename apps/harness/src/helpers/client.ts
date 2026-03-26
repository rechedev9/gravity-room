import { CookieJar } from './cookie-jar';

export const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:3001';

export interface RequestOptions {
  accessToken?: string;
  headers?: Record<string, string>;
}

export interface HarnessClient {
  readonly jar: CookieJar;
  get(path: string, options?: RequestOptions): Promise<Response>;
  post(path: string, body?: unknown, options?: RequestOptions): Promise<Response>;
  patch(path: string, body?: unknown, options?: RequestOptions): Promise<Response>;
  put(path: string, body?: unknown, options?: RequestOptions): Promise<Response>;
  delete(path: string, options?: RequestOptions): Promise<Response>;
}

export function createClient(): HarnessClient {
  const jar = new CookieJar();

  function buildHeaders(
    options: RequestOptions | undefined,
    method: string,
    hasBody: boolean
  ): Record<string, string> {
    const headers: Record<string, string> = {};

    if (options?.accessToken) {
      headers['Authorization'] = `Bearer ${options.accessToken}`;
    }

    if (hasBody && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      headers['Content-Type'] = 'application/json';
    }

    if (options?.headers) {
      Object.assign(headers, options.headers);
    }

    return headers;
  }

  async function send(
    method: string,
    path: string,
    body: unknown | undefined,
    options: RequestOptions | undefined
  ): Promise<Response> {
    const url = new URL(path, BASE_URL);
    const hasBody = body !== undefined;
    const headers = buildHeaders(options, method, hasBody);

    const cookieHeader = jar.getCookieHeader(url);
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const init: RequestInit = {
      method,
      headers,
      ...(hasBody ? { body: JSON.stringify(body) } : {}),
    };

    const response = await fetch(url, init);
    jar.captureFromResponse(url, response);
    return response;
  }

  return {
    jar,
    get: (path, options) => send('GET', path, undefined, options),
    post: (path, body, options) => send('POST', path, body, options),
    patch: (path, body, options) => send('PATCH', path, body, options),
    put: (path, body, options) => send('PUT', path, body, options),
    delete: (path, options) => send('DELETE', path, undefined, options),
  };
}
