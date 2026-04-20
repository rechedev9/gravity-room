import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AuthProvider, useAuth } from './auth-provider';
import { clearSession, restoreSession } from '../lib/auth/session';
import { clearLocalAppData } from '../lib/db/client';
import { clearQueuedMutations, flushQueuedMutations } from '../lib/sync/mutation-sync-service';

jest.mock('../lib/auth/session', () => ({
  clearSession: jest.fn(async () => undefined),
  restoreSession: jest.fn(),
}));

jest.mock('../lib/db/client', () => ({
  clearLocalAppData: jest.fn(),
}));

jest.mock('../lib/sync/mutation-sync-service', () => ({
  clearQueuedMutations: jest.fn(),
  flushQueuedMutations: jest.fn(),
}));

const mockedRestoreSession = jest.mocked(restoreSession);
const mockedClearSession = jest.mocked(clearSession);
const mockedClearLocalAppData = jest.mocked(clearLocalAppData);
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
  const { loading, signOut, user } = useAuth();
  if (loading) return <Text>loading</Text>;
  if (!user) return <Text>signed-out</Text>;

  return (
    <>
      <Text>{user.email}</Text>
      <Text accessibilityRole="button" onPress={() => void signOut()}>
        sign-out
      </Text>
    </>
  );
}

describe('AuthProvider', () => {
  afterEach(() => {
    mockedClearSession.mockReset();
    mockedClearLocalAppData.mockReset();
    mockedClearQueuedMutations.mockReset();
    mockedRestoreSession.mockReset();
    mockedFlushQueuedMutations.mockReset();
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
    mockedClearSession.mockResolvedValue();
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
      expect(mockedClearSession).toHaveBeenCalledTimes(1);
      expect(mockedClearLocalAppData).toHaveBeenCalledTimes(1);
      expect(mockedClearQueuedMutations).toHaveBeenCalledTimes(1);
    });
    const firstQueueClearOrder = mockedClearQueuedMutations.mock.invocationCallOrder[0];
    const firstLocalClearOrder = mockedClearLocalAppData.mock.invocationCallOrder[0];
    expect(firstQueueClearOrder).toBeDefined();
    expect(firstLocalClearOrder).toBeDefined();
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
    mockedClearSession.mockResolvedValue();
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
      expect(mockedClearSession).toHaveBeenCalledTimes(1);
    });
    const firstQueueClearOrder = mockedClearQueuedMutations.mock.invocationCallOrder[0];
    const firstLocalClearOrder = mockedClearLocalAppData.mock.invocationCallOrder[0];
    expect(firstQueueClearOrder).toBeDefined();
    expect(firstLocalClearOrder).toBeDefined();
    expect(firstQueueClearOrder ?? 0).toBeLessThan(firstLocalClearOrder ?? 0);
    expect(await screen.findByText('signed-out')).toBeTruthy();
  });
});
