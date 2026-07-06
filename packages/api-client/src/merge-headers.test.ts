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

  it('lowercases every key iterated from a Headers instance', () => {
    const base = { Accept: 'application/json' };
    const extra = new Headers({ 'X-Custom-Header': 'a', 'ANOTHER-KEY': 'b' });
    const result = mergeHeaders(base, extra);
    // The Headers iterator yields lowercase keys regardless of the input casing;
    // base keys keep their original casing.
    expect(result).toEqual({
      Accept: 'application/json',
      'x-custom-header': 'a',
      'another-key': 'b',
    });
  });

  it('preserves tuple key casing verbatim in the array-of-tuples branch', () => {
    const base = { Accept: 'application/json' };
    const result = mergeHeaders(base, [
      ['X-Custom', 'v1'],
      ['x-other', 'v2'],
    ]);
    expect(result).toEqual({
      Accept: 'application/json',
      'X-Custom': 'v1',
      'x-other': 'v2',
    });
  });

  it('array-of-tuples overrides base keys on exact match and later tuples win', () => {
    const base = { 'Content-Type': 'application/json' };
    const result = mergeHeaders(base, [
      ['Content-Type', 'text/plain'],
      ['Content-Type', 'text/html'],
    ]);
    expect(result).toEqual({ 'Content-Type': 'text/html' });
  });
});
