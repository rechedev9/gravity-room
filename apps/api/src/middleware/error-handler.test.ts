import { describe, it, expect } from 'bun:test';
import { ApiError } from './error-handler';

describe('ApiError', () => {
  it('should set statusCode, message, and code', () => {
    const err = new ApiError(404, 'Not found', 'NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Not found');
    expect(err.code).toBe('NOT_FOUND');
  });

  it('should be an instance of Error', () => {
    const err = new ApiError(500, 'Internal error', 'INTERNAL_ERROR');
    expect(err instanceof Error).toBe(true);
  });

  it('should have name set to ApiError', () => {
    const err = new ApiError(401, 'Unauthorized', 'UNAUTHORIZED');
    expect(err.name).toBe('ApiError');
  });

  it('should be distinguishable from plain Error via instanceof', () => {
    const apiErr = new ApiError(400, 'Bad request', 'BAD_REQUEST');
    const plainErr = new Error('Plain error');
    expect(apiErr instanceof ApiError).toBe(true);
    expect(plainErr instanceof ApiError).toBe(false);
  });

  // 4.8: AUTH_JWKS_UNAVAILABLE code constructs correctly
  it('4.8: ApiError with code AUTH_JWKS_UNAVAILABLE has statusCode 503', () => {
    // Arrange / Act
    const err = new ApiError(503, 'JWKS endpoint unavailable', 'AUTH_JWKS_UNAVAILABLE');

    // Assert
    expect(err.statusCode).toBe(503);
  });

  it('4.8: ApiError with code AUTH_JWKS_UNAVAILABLE has code AUTH_JWKS_UNAVAILABLE', () => {
    // Arrange / Act
    const err = new ApiError(503, 'JWKS endpoint unavailable', 'AUTH_JWKS_UNAVAILABLE');

    // Assert
    expect(err.code).toBe('AUTH_JWKS_UNAVAILABLE');
  });

  it('4.8: ApiError with code AUTH_JWKS_UNAVAILABLE is instanceof ApiError', () => {
    // Arrange / Act
    const err = new ApiError(503, 'JWKS endpoint unavailable', 'AUTH_JWKS_UNAVAILABLE');

    // Assert
    expect(err instanceof ApiError).toBe(true);
  });
});
