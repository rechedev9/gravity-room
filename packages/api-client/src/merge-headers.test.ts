import { describe, expect, it } from 'vitest';
import { mergeHeaders } from './merge-headers.js';

// HTTP header names are case-insensitive, so mergeHeaders normalizes every
// key (base and extra alike) to lowercase and case-variant spellings of the
// same header collapse into a single entry.
describe('mergeHeaders', () => {
  it('lowercases base keys even when extra is undefined', () => {
    const base = { 'Content-Type': 'application/json' };
    const result = mergeHeaders(base, undefined);
    expect(result).toEqual({ 'content-type': 'application/json' });
  });

  it('merges a plain object', () => {
    const base = { 'Content-Type': 'application/json' };
    const result = mergeHeaders(base, { Authorization: 'Bearer token' });
    expect(result).toEqual({
      'content-type': 'application/json',
      authorization: 'Bearer token',
    });
  });

  it('extra plain object overrides base keys regardless of casing', () => {
    const base = { 'Content-Type': 'application/json' };
    const result = mergeHeaders(base, { 'content-type': 'text/plain' });
    expect(result).toEqual({ 'content-type': 'text/plain' });
  });

  it('merges a Headers instance', () => {
    const base = { 'Content-Type': 'application/json' };
    const extra = new Headers({ Authorization: 'Bearer token' });
    const result = mergeHeaders(base, extra);
    expect(result).toEqual({
      'content-type': 'application/json',
      authorization: 'Bearer token',
    });
  });

  it('a Headers-instance entry overrides a case-variant base key', () => {
    const base = { 'Content-Type': 'application/json' };
    const extra = new Headers({ 'Content-Type': 'text/plain' });
    const result = mergeHeaders(base, extra);
    expect(result).toEqual({ 'content-type': 'text/plain' });
  });

  it('merges an array of tuples', () => {
    const base = { 'Content-Type': 'application/json' };
    const result = mergeHeaders(base, [['X-Custom', 'value']]);
    expect(result).toEqual({
      'content-type': 'application/json',
      'x-custom': 'value',
    });
  });

  it('does not mutate the base object', () => {
    const base = { 'Content-Type': 'application/json' };
    mergeHeaders(base, { Authorization: 'Bearer token' });
    expect(base).toEqual({ 'Content-Type': 'application/json' });
  });

  it('lowercases every key from any input casing', () => {
    const base = { Accept: 'application/json' };
    const extra = new Headers({ 'X-Custom-Header': 'a', 'ANOTHER-KEY': 'b' });
    const result = mergeHeaders(base, extra);
    expect(result).toEqual({
      accept: 'application/json',
      'x-custom-header': 'a',
      'another-key': 'b',
    });
  });

  it('collapses case-variant tuple keys onto one entry, later tuples winning', () => {
    const base = { 'Content-Type': 'application/json' };
    const result = mergeHeaders(base, [
      ['content-type', 'text/plain'],
      ['CONTENT-TYPE', 'text/html'],
    ]);
    expect(result).toEqual({ 'content-type': 'text/html' });
  });
});
