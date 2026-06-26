import { describe, expect, it } from 'vitest';
import { mergeHeaders } from './merge-headers.js';

describe('mergeHeaders', () => {
  it('returns base unchanged when extra is undefined', () => {
    const base = { 'Content-Type': 'application/json' };
    const result = mergeHeaders(base, undefined);
    expect(result).toEqual({ 'Content-Type': 'application/json' });
  });

  it('merges a plain object', () => {
    const base = { 'Content-Type': 'application/json' };
    const result = mergeHeaders(base, { Authorization: 'Bearer token' });
    expect(result).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer token',
    });
  });

  it('extra plain object overrides base keys', () => {
    const base = { 'Content-Type': 'application/json' };
    const result = mergeHeaders(base, { 'Content-Type': 'text/plain' });
    expect(result['Content-Type']).toBe('text/plain');
  });

  it('merges a Headers instance', () => {
    const base = { 'Content-Type': 'application/json' };
    const extra = new Headers({ Authorization: 'Bearer token' });
    const result = mergeHeaders(base, extra);
    // Headers normalizes iterated keys to lowercase; base keys retain their original case
    expect(result['authorization']).toBe('Bearer token');
    expect(result['Content-Type']).toBe('application/json');
  });

  it('merges an array of tuples', () => {
    const base = { 'Content-Type': 'application/json' };
    const result = mergeHeaders(base, [['X-Custom', 'value']]);
    expect(result).toEqual({
      'Content-Type': 'application/json',
      'X-Custom': 'value',
    });
  });

  it('does not mutate the base object', () => {
    const base = { 'Content-Type': 'application/json' };
    mergeHeaders(base, { Authorization: 'Bearer token' });
    expect(base).toEqual({ 'Content-Type': 'application/json' });
  });
});
