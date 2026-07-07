import { describe, expect, it } from 'vitest';
import { ApiError, parseApiErrorBody } from './api-error.js';

describe('ApiError', () => {
  it('stores status and message', () => {
    const err = new ApiError('Not found', 404);
    expect(err.message).toBe('Not found');
    expect(err.status).toBe(404);
    expect(err.name).toBe('ApiError');
    expect(err instanceof Error).toBe(true);
  });

  it('stores optional code', () => {
    const err = new ApiError('Forbidden', 403, 'FORBIDDEN');
    expect(err.code).toBe('FORBIDDEN');
  });

  it('code is undefined when not provided', () => {
    const err = new ApiError('Bad request', 400);
    expect(err.code).toBeUndefined();
  });

  it('exposes message, status and code together on a fully-specified instance', () => {
    const err = new ApiError('Too many requests', 429, 'RATE_LIMITED');
    expect(err.message).toBe('Too many requests');
    expect(err.status).toBe(429);
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.name).toBe('ApiError');
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('parseApiErrorBody', () => {
  it('returns message from body.error', () => {
    const result = parseApiErrorBody({ error: 'something went wrong' });
    expect(result).toEqual({ message: 'something went wrong' });
  });

  it('appends code in brackets when body.code present', () => {
    const result = parseApiErrorBody({ error: 'conflict', code: 'DUPLICATE' });
    expect(result).toEqual({ message: 'conflict [DUPLICATE]', code: 'DUPLICATE' });
  });

  it('returns Unknown error for non-record', () => {
    expect(parseApiErrorBody(null)).toEqual({ message: 'Unknown error' });
    expect(parseApiErrorBody('string')).toEqual({ message: 'Unknown error' });
    expect(parseApiErrorBody(42)).toEqual({ message: 'Unknown error' });
  });

  it('returns Unknown error when body.error is not a string', () => {
    expect(parseApiErrorBody({ error: 123 })).toEqual({ message: 'Unknown error' });
  });

  it('returns Unknown error for empty object', () => {
    expect(parseApiErrorBody({})).toEqual({ message: 'Unknown error' });
  });

  it('ignores non-string code', () => {
    const result = parseApiErrorBody({ error: 'oops', code: 42 });
    expect(result).toEqual({ message: 'oops' });
  });

  it('keeps a string code even when there is no string error field', () => {
    // A body like { code: 'X' } has no usable message, but the machine-readable
    // code is still valid — callers must be able to branch on it.
    const result = parseApiErrorBody({ code: 'X' });
    expect(result).toEqual({ message: 'Unknown error', code: 'X' });
  });

  it('keeps a string code when error is present but not a string', () => {
    const result = parseApiErrorBody({ error: 42, code: 'X' });
    expect(result).toEqual({ message: 'Unknown error', code: 'X' });
  });
});
