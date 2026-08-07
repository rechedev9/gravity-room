import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../middleware/error-handler';
import {
  identityErrorCode,
  oauthCookieValue,
  oauthStateCookieOptions,
  providerExchangeErrorCode,
  removeOAuthStateCookie,
  socialCallbackUrl,
} from './auth-oauth';
import type { OAuthSameSite } from './auth-oauth';

describe('OAuth cookie policy', () => {
  const cookiePolicyCases = [
    { sameSite: 'lax', isProduction: false, secure: false },
    { sameSite: 'lax', isProduction: true, secure: true },
    { sameSite: 'none', isProduction: false, secure: true },
    { sameSite: 'none', isProduction: true, secure: true },
  ] satisfies ReadonlyArray<{
    sameSite: OAuthSameSite;
    isProduction: boolean;
    secure: boolean;
  }>;

  it.each(cookiePolicyCases)(
    'uses secure=$secure for $sameSite in production=$isProduction',
    (testCase) => {
      expect(oauthStateCookieOptions(testCase.sameSite, testCase.isProduction)).toEqual({
        httpOnly: true,
        secure: testCase.secure,
        sameSite: testCase.sameSite,
        maxAge: 600,
        path: '/api/auth',
      });
    }
  );

  it.each([
    { value: 'state-value', expected: 'state-value' },
    { value: '', expected: '' },
    { value: 42, expected: undefined },
    { value: undefined, expected: undefined },
  ])('reads only string cookie values: $value', ({ value, expected }) => {
    expect(oauthCookieValue({ value })).toBe(expected);
  });

  it('expires a cookie at the OAuth path with its original SameSite policy', () => {
    const set = vi.fn<(options: Record<string, unknown>) => void>();

    removeOAuthStateCookie({ set }, 'none', false);

    expect(set).toHaveBeenCalledWith({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 0,
      path: '/api/auth',
      value: '',
      expires: new Date(0),
    });
  });

  it('does nothing when the cookie was not present', () => {
    expect(() => removeOAuthStateCookie(undefined, 'lax', false)).not.toThrow();
  });
});

describe('OAuth callback policy', () => {
  it.each([
    { error: undefined, suffix: '?provider=github' },
    { error: 'provider failed', suffix: '?provider=github&error=provider%20failed' },
  ])('builds the SPA callback URL for error=$error', ({ error, suffix }) => {
    const request = new Request('http://localhost:3001/api/auth/github/callback');

    expect(socialCallbackUrl(request, 'github', error)).toBe(
      `http://localhost:5173/auth/callback${suffix}`
    );
  });

  it.each([
    {
      error: new ApiError(401, 'deleted', 'ACCOUNT_DELETED'),
      expected: 'account_deleted',
    },
    {
      error: new ApiError(409, 'conflict', 'ACCOUNT_EXISTS_DIFFERENT_METHOD'),
      expected: 'account_exists',
    },
    { error: new ApiError(500, 'other', 'OTHER'), expected: 'signin_failed' },
    { error: new Error('other'), expected: 'signin_failed' },
  ])('maps identity errors to $expected', ({ error, expected }) => {
    expect(identityErrorCode(error)).toBe(expected);
  });

  it.each([
    {
      error: new ApiError(401, 'missing email', 'AUTH_EMAIL_UNVERIFIED'),
      expected: 'email_required',
    },
    { error: new ApiError(502, 'upstream', 'UPSTREAM_ERROR'), expected: 'provider_error' },
    { error: new Error('network'), expected: 'provider_error' },
  ])('maps provider exchange errors to $expected', ({ error, expected }) => {
    expect(providerExchangeErrorCode(error)).toBe(expected);
  });
});
