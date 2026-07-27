import { Text } from 'react-native';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

import AuthLayout from '../app/(auth)/_layout';
import { RootNavigator } from '../app/_layout';
import IndexRoute from '../app/index';
import { useAuth } from '../providers/auth-provider';

jest.mock('../providers/auth-provider', () => ({
  useAuth: jest.fn(),
}));

const mockedUseAuth = jest.mocked(useAuth);
const authenticatedUser = {
  id: 'user-1',
  email: 'athlete@example.com',
  name: 'Athlete',
  avatarUrl: null,
};

function authValue(user: typeof authenticatedUser | null, loading: boolean) {
  return {
    user,
    loading,
    isGuest: false,
    signInWithGoogle: jest.fn(async () => undefined),
    signInWithEmail: jest.fn(async () => ({ ok: true })),
    signUpWithEmail: jest.fn(async () => ({ ok: true })),
    signOut: jest.fn(async () => undefined),
  };
}

function LoginProbe() {
  return <Text>Login probe</Text>;
}

function ProgramProbe() {
  return <Text>Program deep-link probe</Text>;
}

function PlaceholderProbe() {
  return <Text>Protected placeholder probe</Text>;
}

const routeContext = {
  _layout: RootNavigator,
  index: IndexRoute,
  '(auth)/_layout': AuthLayout,
  '(auth)/login': LoginProbe,
  '(auth)/signup': LoginProbe,
  '(auth)/verify-email': LoginProbe,
  '(tabs)/_layout': PlaceholderProbe,
  'program/[instanceId]': ProgramProbe,
  'program/new': PlaceholderProbe,
  'program/editor/[definitionId]': PlaceholderProbe,
  'workout/history': PlaceholderProbe,
  'workout/[sessionId]': PlaceholderProbe,
  'exercise/index': PlaceholderProbe,
  'exercise/[exerciseId]': PlaceholderProbe,
  sync: PlaceholderProbe,
};

describe('root navigation protection and cold deep links', () => {
  afterEach(() => {
    mockedUseAuth.mockReset();
  });

  it('mounts the root navigator immediately and preserves a protected deep link during restore', () => {
    mockedUseAuth.mockReturnValue(authValue(null, true));

    renderRouter(routeContext, { initialUrl: '/program/program-1' });

    expect(screen.getByTestId('auth-restore-loading')).toBeTruthy();
    expect(screen.getByText('Program deep-link probe')).toBeTruthy();
  });

  it('allows an authenticated cold deep link to the exact dynamic program route', () => {
    mockedUseAuth.mockReturnValue(authValue(authenticatedUser, false));

    renderRouter(routeContext, { initialUrl: '/program/program-1' });

    expect(screen.getByText('Program deep-link probe')).toBeTruthy();
  });

  it('redirects an anonymous cold protected deep link to login after restore', async () => {
    mockedUseAuth.mockReturnValue(authValue(null, false));

    renderRouter(routeContext, { initialUrl: '/program/program-1' });

    await waitFor(() => {
      expect(screen.getByText('Login probe')).toBeTruthy();
    });
    expect(screen.queryByText('Program deep-link probe')).toBeNull();
  });
});
