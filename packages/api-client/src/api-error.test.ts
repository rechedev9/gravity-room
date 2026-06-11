import { describe, expect, it } from 'bun:test';
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
});
