import { isRecord } from '@gzclp/domain/type-guards';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Extract a human-readable error message (and optional machine-readable code)
 * from an unknown API response body.
 *
 * Matches the format used by extractErrorMessage in api-functions.ts:
 * - If body has a string `error` field, use it as the message.
 * - If body also has a string `code` field, append it: "msg [code]".
 * - A string `code` is preserved even when `error` is missing or malformed,
 *   so callers can still branch on it.
 */
export function parseApiErrorBody(body: unknown): { message: string; code?: string } {
  if (!isRecord(body)) return { message: 'Unknown error' };
  const code = typeof body.code === 'string' ? body.code : undefined;
  if (typeof body.error === 'string') {
    if (code !== undefined) {
      return { message: `${body.error} [${code}]`, code };
    }
    return { message: body.error };
  }
  if (code !== undefined) {
    return { message: 'Unknown error', code };
  }
  return { message: 'Unknown error' };
}
