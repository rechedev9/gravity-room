import { useEffect, useSyncExternalStore } from 'react';
import { Text } from 'react-native';
import { act } from '@testing-library/react-native';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

import AuthLayout from '../app/(auth)/_layout';
import ProtectedLayout from '../app/(protected)/_layout';
import { RootNavigator } from '../app/_layout';
import IndexRoute from '../app/index';
import { useAuth } from '../providers/auth-provider';
import { useDatabaseBootstrapState } from '../providers/database-bootstrap-gate';

jest.mock('../providers/auth-provider', () => ({
  useAuth: jest.fn(),
}));
jest.mock('../providers/database-bootstrap-gate', () => ({
  useDatabaseBootstrapState: jest.fn(),
}));

const mockedUseAuth = jest.mocked(useAuth);
const mockedUseDatabaseBootstrapState = jest.mocked(useDatabaseBootstrapState);
const protectedEffect = jest.fn();
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

type TestAuthValue = ReturnType<typeof authValue>;
let currentAuth: TestAuthValue = authValue(null, true);
const authSubscribers = new Set<() => void>();

function subscribeToAuth(listener: () => void): () => void {
  authSubscribers.add(listener);
  return () => authSubscribers.delete(listener);
}

function readAuthSnapshot(): TestAuthValue {
  return currentAuth;
}

function useTestAuthState(): TestAuthValue {
  return useSyncExternalStore(subscribeToAuth, readAuthSnapshot, readAuthSnapshot);
}

function transitionAuth(nextAuth: TestAuthValue): void {
  currentAuth = nextAuth;
  for (const subscriber of authSubscribers) {
    subscriber();
  }
}

function LoginProbe() {
  return <Text>Login probe</Text>;
}

function ProgramProbe() {
  useEffect(() => {
    protectedEffect();
  }, []);

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
  '(protected)/_layout': ProtectedLayout,
  '(protected)/(tabs)/_layout': PlaceholderProbe,
  '(protected)/program/[instanceId]': ProgramProbe,
  '(protected)/program/new': PlaceholderProbe,
  '(protected)/program/editor/[definitionId]': PlaceholderProbe,
  '(protected)/workout/history': PlaceholderProbe,
  '(protected)/workout/[sessionId]': PlaceholderProbe,
  '(protected)/exercise/index': PlaceholderProbe,
  '(protected)/exercise/[exerciseId]': PlaceholderProbe,
  '(protected)/sync': PlaceholderProbe,
};

describe('root navigation protection and cold deep links', () => {
  beforeEach(() => {
    mockedUseDatabaseBootstrapState.mockReturnValue({ status: 'ready' });
    currentAuth = authValue(null, true);
    mockedUseAuth.mockImplementation(useTestAuthState);
    protectedEffect.mockClear();
  });

  afterEach(() => {
    mockedUseAuth.mockReset();
    mockedUseDatabaseBootstrapState.mockReset();
  });

  it('preserves a cold link without mounting its effects, then mounts it once after auth', async () => {
    renderRouter(routeContext, { initialUrl: '/program/program-1' });

    expect(screen.getByTestId('auth-restore-loading')).toBeTruthy();
    expect(screen.queryByText('Program deep-link probe')).toBeNull();
    expect(protectedEffect).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('auth-restore-content', { includeHiddenElements: true }).props
    ).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
    expect(screen.getByTestId('auth-restore-loading').props).toMatchObject({
      accessibilityViewIsModal: true,
      importantForAccessibility: 'yes',
    });

    act(() => {
      transitionAuth(authValue(authenticatedUser, false));
    });

    expect(await screen.findByText('Program deep-link probe')).toBeTruthy();
    expect(protectedEffect).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('auth-restore-loading')).toBeNull();
  });

  it('never mounts protected effects when the same cold-link tree restores anonymous', async () => {
    renderRouter(routeContext, { initialUrl: '/program/program-1' });
    expect(protectedEffect).not.toHaveBeenCalled();

    act(() => {
      transitionAuth(authValue(null, false));
    });

    await waitFor(() => {
      expect(screen.getByText('Login probe')).toBeTruthy();
    });
    expect(screen.queryByText('Program deep-link probe')).toBeNull();
    expect(protectedEffect).not.toHaveBeenCalled();
  });
});
