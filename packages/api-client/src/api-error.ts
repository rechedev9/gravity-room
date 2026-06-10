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
 */
export function parseApiErrorBody(body: unknown): { message: string; code?: string } {
  if (isRecord(body) && typeof body.error === 'string') {
    if (typeof body.code === 'string') {
      return { message: `${body.error} [${body.code}]`, code: body.code };
    }
    return { message: body.error };
  }
  return { message: 'Unknown error' };
}
