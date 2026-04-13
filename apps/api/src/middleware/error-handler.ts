/**
 * Custom API error class for structured error responses.
 * Thrown in services/middleware, caught by the global onError handler.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly headers?: Readonly<Record<string, string>>;

  constructor(
    statusCode: number,
    message: string,
    code: string,
    options?: { headers?: Record<string, string> }
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    if (options?.headers) this.headers = options.headers;
  }
}
