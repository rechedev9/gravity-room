import {
  AUTH_ROUTES,
  createProgramRoute,
  parseProgramInstanceId,
  PRIMARY_TAB_ROUTES,
  resolveInitialRoute,
} from './routes';

describe('mobile navigation contract', () => {
  it('routes anonymous sessions to login and restored sessions to Tracker', () => {
    expect(resolveInitialRoute({ status: 'loading' })).toBeNull();
    expect(resolveInitialRoute({ status: 'anonymous' })).toBe(AUTH_ROUTES.login);
    expect(resolveInitialRoute({ status: 'authenticated' })).toBe(PRIMARY_TAB_ROUTES.tracker);
  });

  it('exposes exactly Programs, Tracker, and Profile as primary tabs', () => {
    expect(PRIMARY_TAB_ROUTES).toEqual({
      programs: '/programs',
      tracker: '/tracker',
      profile: '/profile',
    });
  });

  it('builds and validates program deep links without leaking router concerns into features', () => {
    expect(createProgramRoute('program_123')).toEqual({
      pathname: '/program/[instanceId]',
      params: { instanceId: 'program_123' },
    });
    expect(parseProgramInstanceId('program-123')).toBe('program-123');
    expect(parseProgramInstanceId(['program-123'])).toBeNull();
    expect(parseProgramInstanceId('../profile')).toBeNull();
    expect(parseProgramInstanceId('')).toBeNull();
  });
});
