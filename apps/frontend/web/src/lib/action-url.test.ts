import { beforeEach, describe, expect, it } from 'vitest';
import { clearActionToken, getActionToken, stripActionTokenFromCurrentUrl } from './action-url';

describe('action URL token handling', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it.each([
    ['/reset-password', 'reset-secret'],
    ['/verify-email', 'verify-secret'],
  ])('synchronously removes the token from %s while retaining it for the action', (path, token) => {
    window.history.replaceState({ retained: 'safe' }, '', `${path}?token=${token}&lang=en#form`);

    stripActionTokenFromCurrentUrl();

    expect(window.location.pathname).toBe(path);
    expect(window.location.search).toBe('?lang=en');
    expect(window.location.hash).toBe('#form');
    expect(window.location.href).not.toContain(token);
    expect(getActionToken(path)).toBe(token);
    expect(window.history.state.retained).toBe('safe');
  });

  it('ignores token parameters on non-action routes', () => {
    window.history.replaceState({}, '', '/login?token=not-an-action-token');

    stripActionTokenFromCurrentUrl();

    expect(window.location.search).toBe('?token=not-an-action-token');
  });

  it('clears the captured token without changing the clean URL', () => {
    window.history.replaceState({}, '', '/reset-password?token=secret');
    expect(getActionToken('/reset-password')).toBe('secret');

    clearActionToken('/reset-password');

    expect(getActionToken('/reset-password')).toBeNull();
    expect(window.location.href).not.toContain('secret');
  });
});
