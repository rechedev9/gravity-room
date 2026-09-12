import { readAuthUser, readRefreshResponse, readSessionResponse } from './session-response';

const USER = {
  id: 'athlete',
  email: 'athlete@example.test',
  name: 'Athlete',
  avatarUrl: 'https://example.test/avatar.webp',
};

describe('mobile auth response decoding', () => {
  it('normalizes absent optional profile fields without mutating input', () => {
    const input = Object.freeze({ id: USER.id, email: USER.email });
    expect(readAuthUser(input)).toEqual({ ...input, name: null, avatarUrl: null });
    expect(input).not.toHaveProperty('name');
  });

  it('preserves explicit nulls, empty optional strings and Unicode', () => {
    expect(readAuthUser({ ...USER, name: null, avatarUrl: null })).toEqual({
      ...USER,
      name: null,
      avatarUrl: null,
    });
    expect(readAuthUser({ ...USER, name: '', avatarUrl: '' })).toEqual({
      ...USER,
      name: '',
      avatarUrl: '',
    });
    expect(readAuthUser({ ...USER, name: 'José 🏋️' }).name).toBe('José 🏋️');
  });

  it('copies only identity fields and does not retain a mutable source object', () => {
    const input = { ...USER, accessToken: 'must-not-copy', admin: true };
    const parsed = readAuthUser(input);
    input.name = 'Changed';
    expect(parsed).toEqual(USER);
    expect(parsed).not.toHaveProperty('accessToken');
    expect(parsed).not.toHaveProperty('admin');
  });

  it.each([
    null,
    undefined,
    false,
    1,
    'user',
    [],
    {},
    { id: 'a' },
    { email: 'a' },
    { ...USER, id: 1 },
    { ...USER, email: false },
    { ...USER, name: [] },
    { ...USER, avatarUrl: {} },
  ])('rejects malformed identity %j', (input) => {
    expect(() => readAuthUser(input)).toThrow('Invalid mobile auth response');
  });

  it('decodes a mobile refresh with both body tokens', () => {
    const input = { accessToken: 'access', refreshToken: 'refresh', user: USER, ignored: 'extra' };
    expect(readRefreshResponse(input)).toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
      user: USER,
    });
  });

  it('decodes cookie sessions without exposing a body refresh token', () => {
    expect(
      readSessionResponse({ accessToken: 'access', user: USER, refreshToken: 'must-not-copy' })
    ).toEqual({ accessToken: 'access', user: USER });
    expect(readSessionResponse({ accessToken: 'access', user: USER })).not.toHaveProperty(
      'refreshToken'
    );
  });

  it.each([readSessionResponse, readRefreshResponse])(
    'rejects invalid session envelopes through %p',
    (parse) => {
      for (const input of [
        null,
        undefined,
        [],
        false,
        {},
        { user: USER },
        { accessToken: 123, refreshToken: 'refresh', user: USER },
        { accessToken: 'access', refreshToken: 'refresh', user: null },
        { accessToken: 'access', refreshToken: 'refresh', user: { ...USER, name: false } },
      ]) {
        expect(() => parse(input)).toThrow('Invalid mobile auth response');
      }
    }
  );

  it.each([undefined, null, 123, {}, false])(
    'requires a string body refresh token, received %j',
    (refreshToken) => {
      expect(() =>
        readRefreshResponse({ accessToken: 'access', user: USER, refreshToken })
      ).toThrow('Invalid mobile auth response');
    }
  );

  it('normalizes users consistently across both response transports', () => {
    const user = { id: USER.id, email: USER.email };
    const expectedUser = { ...user, name: null, avatarUrl: null };
    expect(readSessionResponse({ accessToken: 'access', user }).user).toEqual(expectedUser);
    expect(
      readRefreshResponse({ accessToken: 'access', refreshToken: 'refresh', user }).user
    ).toEqual(expectedUser);
  });

  it('does not include submitted credentials in validation errors', () => {
    const secret = 'private-token-value';
    expect(() =>
      readRefreshResponse({ accessToken: secret, refreshToken: 123, user: USER })
    ).toThrow(/^Invalid mobile auth response$/);
  });
});
