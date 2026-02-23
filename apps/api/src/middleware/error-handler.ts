/**
 * Named ApiError codes used throughout the API.
 * The ApiError constructor accepts any string — this constant documents
 * the bounded set of domain codes in use. Keep in sync with usages.
 */
export const ApiErrorCode = {
  // Auth
  UNAUTHORIZED: 'UNAUTHORIZED',
  AUTH_INVALID: 'AUTH_INVALID',
  AUTH_JWKS_UNAVAILABLE: 'AUTH_JWKS_UNAVAILABLE',
  // Database
  DB_WRITE_ERROR: 'DB_WRITE_ERROR',
  // Config
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  // Resources
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  // Program definitions
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  // Generic
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type ApiErrorCodeValue = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

/**
 * Custom API error class for structured error responses.
 * Thrown in services/middleware, caught by the global onError handler.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, message: string, code: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}
