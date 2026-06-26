import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAppleConfigured, buildAppleAuthorizeUrl, parseAppleUserName } from './apple-auth';

const ORIGINAL = process.env['APPLE_CLIENT_ID'];

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env['APPLE_CLIENT_ID'];
  else process.env['APPLE_CLIENT_ID'] = ORIGINAL;
});

describe('isAppleConfigured', () => {
  it('is false when APPLE_CLIENT_ID is unset', () => {
    delete process.env['APPLE_CLIENT_ID'];
    expect(isAppleConfigured()).toBe(false);
  });

  it('is true when APPLE_CLIENT_ID is set', () => {
    process.env['APPLE_CLIENT_ID'] = 'com.example.service';
    expect(isAppleConfigured()).toBe(true);
  });
});

describe('buildAppleAuthorizeUrl', () => {
  beforeEach(() => {
    process.env['APPLE_CLIENT_ID'] = 'com.example.service';
  });

  it('builds an authorize URL with form_post and the expected params', () => {
    const url = new URL(
      buildAppleAuthorizeUrl(
        'state-123',
        'https://api.example.com/api/auth/apple/callback',
        'nonce-123'
      )
    );
    expect(url.origin + url.pathname).toBe('https://appleid.apple.com/auth/authorize');
    expect(url.searchParams.get('client_id')).toBe('com.example.service');
    expect(url.searchParams.get('response_type')).toBe('code id_token');
    expect(url.searchParams.get('response_mode')).toBe('form_post');
    expect(url.searchParams.get('state')).toBe('state-123');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://api.example.com/api/auth/apple/callback'
    );
    expect(url.searchParams.get('scope')).toBe('name email');
    expect(url.searchParams.get('nonce')).toBe('nonce-123');
  });

  it('throws when the client id is missing', () => {
    delete process.env['APPLE_CLIENT_ID'];
    expect(() => buildAppleAuthorizeUrl('s', 'r')).toThrow('not configured');
  });
});

describe('parseAppleUserName', () => {
  it('returns undefined for missing or non-JSON input', () => {
    expect(parseAppleUserName(undefined)).toBeUndefined();
    expect(parseAppleUserName('not json')).toBeUndefined();
    expect(parseAppleUserName('{}')).toBeUndefined();
  });

  it('joins first and last name', () => {
    expect(parseAppleUserName('{"name":{"firstName":"Ada","lastName":"Lovelace"}}')).toBe(
      'Ada Lovelace'
    );
  });

  it('handles a single name part', () => {
    expect(parseAppleUserName('{"name":{"firstName":"Ada"}}')).toBe('Ada');
  });
});
