import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';

import { AuthProvider, useAuth } from './auth-provider';
import {
  getAccessToken,
  restoreSession,
  setAccessToken,
  signInWithGoogleIdToken,
  signOutSession,
} from '../lib/auth/session';
import { secureLocalDataOwnerStorage } from '../lib/auth/secure-storage';
import {
  activateLocalDataOwner,
  clearLocalAppData,
  deactivateLocalDataOwner,
} from '../lib/db/client';
import { clearQueuedMutations, flushQueuedMutations } from '../lib/sync/mutation-sync-service';

jest.mock('../lib/auth/session', () => ({
  getAccessToken: jest.fn(),
  restoreSession: jest.fn(),
  setAccessToken: jest.fn(),
  signInWithGoogleIdToken: jest.fn(),
  signInWithEmailPassword: jest.fn(),
  signUpWithEmailPassword: jest.fn(),
  signOutSession: jest.fn(async () => undefined),
}));

jest.mock('../lib/db/client', () => ({
  activateLocalDataOwner: jest.fn(),
  clearLocalAppData: jest.fn(),
  deactivateLocalDataOwner: jest.fn(),
}));

jest.mock('../lib/auth/secure-storage', () => ({
  secureLocalDataOwnerStorage: {
    getOwnerId: jest.fn(),
    setOwnerId: jest.fn(),
    clearOwnerId: jest.fn(),
  },
}));

jest.mock('../lib/sync/mutation-sync-service', () => ({
  clearQueuedMutations: jest.fn(),
  flushQueuedMutations: jest.fn(),
}));

const mockedRestoreSession = jest.mocked(restoreSession);
const mockedGetAccessToken = jest.mocked(getAccessToken);
const mockedSetAccessToken = jest.mocked(setAccessToken);
const mockedSignInWithGoogleIdToken = jest.mocked(signInWithGoogleIdToken);
const mockedSignOutSession = jest.mocked(signOutSession);
const mockedLocalDataOwnerStorage = jest.mocked(secureLocalDataOwnerStorage);
const mockedActivateLocalDataOwner = jest.mocked(activateLocalDataOwner);
const mockedClearLocalAppData = jest.mocked(clearLocalAppData);
const mockedDeactivateLocalDataOwner = jest.mocked(deactivateLocalDataOwner);
const mockedClearQueuedMutations = jest.mocked(clearQueuedMutations);
const mockedFlushQueuedMutations = jest.mocked(flushQueuedMutations);

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

function AuthProbe() {
  const { loading, signInWithGoogle, signOut, user } = useAuth();
  if (loading) return <Text>loading</Text>;
  if (!user) return <Text>signed-out</Text>;

  return (
    <>
      <Text>{user.email}</Text>
      <Text
        accessibilityRole="button"
        onPress={() => {
          void signOut().catch(() => undefined);
        }}
      >
        sign-out
      </Text>
    </>
  );
}

function SignInProbe() {
  const { loading, signInWithGoogle, user } = useAuth();
  if (loading) return <Text>loading</Text>;
  if (user) return <Text>{user.email}</Text>;

  return (
    <Text
      accessibilityRole="button"
      onPress={() => {
        void signInWithGoogle('google-id-token').catch(() => undefined);
      }}
    >
      sign-in
    </Text>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
    mockedLocalDataOwnerStorage.getOwnerId.mockResolvedValue('user-123');
    mockedLocalDataOwnerStorage.setOwnerId.mockResolvedValue();
    mockedLocalDataOwnerStorage.clearOwnerId.mockResolvedValue();
    mockedActivateLocalDataOwner.mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockedSignInWithGoogleIdToken.mockReset();
    mockedSignOutSession.mockReset();
    mockedActivateLocalDataOwner.mockReset();
    mockedClearLocalAppData.mockReset();
    mockedDeactivateLocalDataOwner.mockReset();
    mockedClearQueuedMutations.mockReset();
    mockedRestoreSession.mockReset();
    mockedFlushQueuedMutations.mockReset();
    mockedGetAccessToken.mockReset();
    mockedSetAccessToken.mockReset();
    mockedLocalDataOwnerStorage.getOwnerId.mockReset();
    mockedLocalDataOwnerStorage.setOwnerId.mockReset();
    mockedLocalDataOwnerStorage.clearOwnerId.mockReset();
  });

  it('flushes queued mutations after a successful session restore', async () => {
    mockedRestoreSession.mockResolvedValue({
      accessToken: 'restored-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });
    mockedFlushQueuedMutations.mockResolvedValue({ processedCount: 2 });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    expect(await screen.findByText('athlete@example.com')).toBeTruthy();
    await waitFor(() => {
      expect(mockedActivateLocalDataOwner).toHaveBeenCalledWith('user-123');
      expect(mockedSetAccessToken).toHaveBeenCalledWith('restored-access-token');
      expect(mockedFlushQueuedMutations).toHaveBeenCalledWith('restored-access-token');
    });
  });

  it('does not block rendering on a slow queued mutation flush', async () => {
    const slowFlush = createDeferred<{ processedCount: number }>();

    mockedRestoreSession.mockResolvedValue({
      accessToken: 'restored-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });
    mockedFlushQueuedMutations.mockReturnValue(slowFlush.promise);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    expect(await screen.findByText('athlete@example.com')).toBeTruthy();
    expect(mockedFlushQueuedMutations).toHaveBeenCalledWith('restored-access-token');

    slowFlush.resolve({ processedCount: 0 });
  });

  it('clears queued offline mutations on sign-out', async () => {
    mockedRestoreSession.mockResolvedValue({
      accessToken: 'restored-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });
    mockedFlushQueuedMutations.mockResolvedValue({ processedCount: 0 });
    mockedSignOutSession.mockResolvedValue();
    mockedClearLocalAppData.mockResolvedValue();
    mockedClearQueuedMutations.mockResolvedValue();

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    expect(await screen.findByText('athlete@example.com')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'sign-out' }));

    await waitFor(() => {
      expect(mockedSignOutSession).toHaveBeenCalledTimes(1);
      expect(mockedClearLocalAppData).toHaveBeenCalledTimes(1);
      expect(mockedClearQueuedMutations).toHaveBeenCalledTimes(1);
    });
    const signOutOrder = mockedSignOutSession.mock.invocationCallOrder[0];
    const firstQueueClearOrder = mockedClearQueuedMutations.mock.invocationCallOrder[0];
    const firstLocalClearOrder = mockedClearLocalAppData.mock.invocationCallOrder[0];
    expect(signOutOrder).toBeDefined();
    expect(firstQueueClearOrder).toBeDefined();
    expect(firstLocalClearOrder).toBeDefined();
    expect(signOutOrder ?? 0).toBeLessThan(firstQueueClearOrder ?? 0);
    expect(firstQueueClearOrder ?? 0).toBeLessThan(firstLocalClearOrder ?? 0);
    expect(await screen.findByText('signed-out')).toBeTruthy();
  });

  it('still clears the session when queued mutation cleanup fails on sign-out', async () => {
    mockedRestoreSession.mockResolvedValue({
      accessToken: 'restored-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });
    mockedFlushQueuedMutations.mockResolvedValue({ processedCount: 0 });
    mockedSignOutSession.mockResolvedValue();
    mockedClearLocalAppData.mockRejectedValue(new Error('SQLite unavailable'));
    mockedClearQueuedMutations.mockRejectedValue(new Error('SQLite unavailable'));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    expect(await screen.findByText('athlete@example.com')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'sign-out' }));

    await waitFor(() => {
      expect(mockedClearLocalAppData).toHaveBeenCalledTimes(1);
      expect(mockedClearQueuedMutations).toHaveBeenCalledTimes(1);
      expect(mockedSignOutSession).toHaveBeenCalledTimes(1);
    });
    const signOutOrder = mockedSignOutSession.mock.invocationCallOrder[0];
    const firstQueueClearOrder = mockedClearQueuedMutations.mock.invocationCallOrder[0];
    const firstLocalClearOrder = mockedClearLocalAppData.mock.invocationCallOrder[0];
    expect(signOutOrder).toBeDefined();
    expect(firstQueueClearOrder).toBeDefined();
    expect(firstLocalClearOrder).toBeDefined();
    expect(signOutOrder ?? 0).toBeLessThan(firstQueueClearOrder ?? 0);
    expect(firstQueueClearOrder ?? 0).toBeLessThan(firstLocalClearOrder ?? 0);
    expect(mockedLocalDataOwnerStorage.clearOwnerId).not.toHaveBeenCalled();
    expect(mockedDeactivateLocalDataOwner).toHaveBeenCalled();
    expect(mockedSetAccessToken).toHaveBeenCalledWith(null);
    expect(await screen.findByText('signed-out')).toBeTruthy();
  });

  it('retains authenticated UI and local state when durable sign-out deletion fails', async () => {
    mockedRestoreSession.mockResolvedValue({
      accessToken: 'restored-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });
    mockedFlushQueuedMutations.mockResolvedValue({ processedCount: 0 });
    mockedSignOutSession
      .mockRejectedValueOnce(new Error('SecureStore deletion failed'))
      .mockResolvedValueOnce();
    mockedClearLocalAppData.mockResolvedValue();
    mockedClearQueuedMutations.mockResolvedValue();

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    expect(await screen.findByText('athlete@example.com')).toBeTruthy();
    mockedDeactivateLocalDataOwner.mockClear();
    mockedSetAccessToken.mockClear();
    mockedClearQueuedMutations.mockClear();
    mockedClearLocalAppData.mockClear();

    fireEvent.press(screen.getByRole('button', { name: 'sign-out' }));

    await waitFor(() => expect(mockedSignOutSession).toHaveBeenCalledTimes(1));
    expect(screen.getByText('athlete@example.com')).toBeTruthy();
    expect(mockedDeactivateLocalDataOwner).not.toHaveBeenCalled();
    expect(mockedSetAccessToken).not.toHaveBeenCalledWith(null);
    expect(mockedClearQueuedMutations).not.toHaveBeenCalled();
    expect(mockedClearLocalAppData).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'sign-out' }));
    expect(await screen.findByText('signed-out')).toBeTruthy();
    expect(mockedSignOutSession).toHaveBeenCalledTimes(2);
  });

  it('hydrates auth state after exchanging a Google credential', async () => {
    mockedRestoreSession.mockResolvedValue(null);
    mockedSignInWithGoogleIdToken.mockResolvedValue({
      accessToken: 'fresh-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });
    mockedFlushQueuedMutations.mockResolvedValue({ processedCount: 0 });

    render(
      <AuthProvider>
        <SignInProbe />
      </AuthProvider>
    );

    fireEvent.press(await screen.findByRole('button', { name: 'sign-in' }));

    expect(await screen.findByText('athlete@example.com')).toBeTruthy();
    expect(mockedSignInWithGoogleIdToken).toHaveBeenCalledWith('google-id-token');
    expect(mockedFlushQueuedMutations).toHaveBeenCalledWith('fresh-access-token');
  });

  it('clears another account cache and outbox before exposing the signed-in user', async () => {
    const accessToken = String(1);
    mockedRestoreSession.mockResolvedValue(null);
    mockedLocalDataOwnerStorage.getOwnerId.mockResolvedValue('previous-user');
    mockedClearQueuedMutations.mockResolvedValue();
    mockedClearLocalAppData.mockResolvedValue();
    mockedLocalDataOwnerStorage.setOwnerId.mockResolvedValue();
    mockedSignInWithGoogleIdToken.mockResolvedValue({
      accessToken,
      user: {
        id: 'next-user',
        email: 'next@example.com',
        name: 'Next Athlete',
        avatarUrl: null,
      },
    });
    mockedFlushQueuedMutations.mockResolvedValue({ processedCount: 0 });

    render(
      <AuthProvider>
        <SignInProbe />
      </AuthProvider>
    );

    fireEvent.press(await screen.findByRole('button', { name: 'sign-in' }));
    expect(await screen.findByText('next@example.com')).toBeTruthy();

    expect(mockedClearQueuedMutations).toHaveBeenCalledTimes(1);
    expect(mockedClearLocalAppData).toHaveBeenCalledTimes(1);
    expect(mockedLocalDataOwnerStorage.setOwnerId).toHaveBeenCalledWith('next-user');
    expect(mockedActivateLocalDataOwner).toHaveBeenCalledWith('next-user');
    expect(mockedSetAccessToken).toHaveBeenCalledWith(accessToken);
    const clearOrder = mockedClearLocalAppData.mock.invocationCallOrder[0] ?? 0;
    const ownerOrder = mockedLocalDataOwnerStorage.setOwnerId.mock.invocationCallOrder[0] ?? 0;
    const activateOrder = mockedActivateLocalDataOwner.mock.invocationCallOrder[0] ?? 0;
    const publishOrder = mockedSetAccessToken.mock.invocationCallOrder[0] ?? 0;
    const flushOrder = mockedFlushQueuedMutations.mock.invocationCallOrder[0] ?? 0;
    expect(clearOrder).toBeLessThan(ownerOrder);
    expect(ownerOrder).toBeLessThan(activateOrder);
    expect(activateOrder).toBeLessThan(publishOrder);
    expect(publishOrder).toBeLessThan(flushOrder);
  });

  it.each([
    {
      name: 'owner marker read',
      configure: () =>
        mockedLocalDataOwnerStorage.getOwnerId.mockRejectedValue(
          new Error('SecureStore read failed')
        ),
    },
    {
      name: 'outbox cleanup',
      configure: () => {
        mockedLocalDataOwnerStorage.getOwnerId.mockResolvedValue('previous-user');
        mockedClearQueuedMutations.mockRejectedValue(new Error('outbox cleanup failed'));
      },
    },
    {
      name: 'SQLite cleanup',
      configure: () => {
        mockedLocalDataOwnerStorage.getOwnerId.mockResolvedValue('previous-user');
        mockedClearLocalAppData.mockRejectedValue(new Error('SQLite cleanup failed'));
      },
    },
    {
      name: 'owner marker write',
      configure: () => {
        mockedLocalDataOwnerStorage.getOwnerId.mockResolvedValue('previous-user');
        mockedLocalDataOwnerStorage.setOwnerId.mockRejectedValue(
          new Error('SecureStore write failed')
        );
      },
    },
    {
      name: 'SQLite owner activation',
      configure: () =>
        mockedActivateLocalDataOwner.mockRejectedValue(new Error('SQLite validation failed')),
    },
  ])('fails closed when $name fails during account switch', async ({ configure }) => {
    mockedRestoreSession.mockResolvedValue(null);
    mockedLocalDataOwnerStorage.getOwnerId.mockResolvedValue('next-user');
    mockedSignInWithGoogleIdToken.mockResolvedValue({
      accessToken: 'new-account-token',
      user: {
        id: 'next-user',
        email: 'next@example.com',
        name: 'Next Athlete',
        avatarUrl: null,
      },
    });
    configure();

    render(
      <AuthProvider>
        <SignInProbe />
      </AuthProvider>
    );

    fireEvent.press(await screen.findByRole('button', { name: 'sign-in' }));

    await waitFor(() => {
      expect(mockedSignInWithGoogleIdToken).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('next@example.com')).toBeNull();
    });
    expect(mockedSetAccessToken).not.toHaveBeenCalledWith('new-account-token');
    expect(mockedFlushQueuedMutations).not.toHaveBeenCalled();
  });
});
