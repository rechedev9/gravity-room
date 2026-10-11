import { ApiError, parseApiErrorBody } from './api-error';

/**
 * Builds the ApiError for a failed response. The server's own message wins;
 * `fallback` is used when the body carries none (or is not JSON).
 */
export async function readApiError(response: Response, fallback: string): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => ({}));
  const { message, code } = parseApiErrorBody(body);
  return new ApiError(message === 'Unknown error' ? fallback : message, response.status, code);
}
