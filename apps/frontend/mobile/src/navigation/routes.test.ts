import {
  AUTH_ROUTES,
  createProgramRoute,
  loadInitialRouteContext,
  parseProgramInstanceId,
  PRIMARY_TAB_ROUTES,
  resolveInitialRoute,
  returnFromProgramRoute,
  returnFromSecondaryRoute,
} from './routes';

describe('mobile navigation contract', () => {
  it('resolves anonymous, active-workout, persisted-tab, and fallback startup states in order', () => {
    expect(resolveInitialRoute({ status: 'loading' })).toBeNull();
    expect(resolveInitialRoute({ status: 'anonymous' })).toBe(AUTH_ROUTES.login);
    expect(
      resolveInitialRoute(
        { status: 'authenticated' },
        { hasActiveWorkout: true, lastPrimaryTab: 'profile' }
      )
    ).toBe(PRIMARY_TAB_ROUTES.tracker);
    expect(
      resolveInitialRoute(
        { status: 'authenticated' },
        { hasActiveWorkout: false, lastPrimaryTab: 'profile' }
      )
    ).toBe(PRIMARY_TAB_ROUTES.profile);
    expect(resolveInitialRoute({ status: 'authenticated' })).toBe(PRIMARY_TAB_ROUTES.programs);
  });

  it('loads the active-workout and last-tab adapters independently and fails safe', async () => {
    await expect(
      loadInitialRouteContext({
        activeWorkoutLookup: {
          hasInProgressWorkout: async () => {
            throw new Error('M3 repository unavailable');
          },
        },
        readLastPrimaryTab: async () => 'profile',
      })
    ).resolves.toEqual({ hasActiveWorkout: false, lastPrimaryTab: 'profile' });

    await expect(
      loadInitialRouteContext({
        activeWorkoutLookup: { hasInProgressWorkout: async () => true },
        readLastPrimaryTab: async () => {
          throw new Error('SecureStore unavailable');
        },
      })
    ).resolves.toEqual({ hasActiveWorkout: true, lastPrimaryTab: null });
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

  it('returns safely from a cold program deep link with no navigation history', () => {
    const router = {
      back: jest.fn(),
      canGoBack: jest.fn(() => false),
      replace: jest.fn(),
    };

    returnFromProgramRoute(router);

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith(PRIMARY_TAB_ROUTES.programs);
  });

  it('uses navigation history when the program route was opened in-app', () => {
    const router = {
      back: jest.fn(),
      canGoBack: jest.fn(() => true),
      replace: jest.fn(),
    };

    returnFromProgramRoute(router);

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('applies the same safe history contract to deferred secondary routes', () => {
    const coldRouter = {
      back: jest.fn(),
      canGoBack: jest.fn(() => false),
      replace: jest.fn(),
    };
    const stackedRouter = {
      back: jest.fn(),
      canGoBack: jest.fn(() => true),
      replace: jest.fn(),
    };

    returnFromSecondaryRoute(coldRouter);
    returnFromSecondaryRoute(stackedRouter);

    expect(coldRouter.replace).toHaveBeenCalledWith(PRIMARY_TAB_ROUTES.programs);
    expect(stackedRouter.back).toHaveBeenCalledTimes(1);
  });
});
