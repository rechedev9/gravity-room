import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mocks } = vi.hoisted(() => ({
  mocks: {
    user: { id: 'qa5-user', email: 'qa5@example.com' } as {
      readonly id: string;
      readonly email: string;
    } | null,
    accessToken: 'session-token' as string | null,
    migrate: vi.fn(),
    readActive: vi.fn(),
    hasFreshIntent: vi.fn(),
    discard: vi.fn(),
    toast: vi.fn(),
  },
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: mocks.user }),
  getAuthSessionIdentity: () =>
    mocks.user !== null && mocks.accessToken !== null
      ? { userId: mocks.user.id, sessionId: mocks.accessToken }
      : null,
}));
vi.mock('@/contexts/toast-context', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));
vi.mock('@/lib/guest-storage', () => ({
  readActiveGuestInstance: mocks.readActive,
}));
vi.mock('@/lib/guest-migration', () => ({
  migrateGuestDataToAccount: mocks.migrate,
  hasFreshGuestMigrationIntent: mocks.hasFreshIntent,
  discardGuestMigrationData: mocks.discard,
}));
vi.mock('@/lib/catalog-display', () => ({
  localizedProgramName: (_t: unknown, _id: string, fallback: string) => fallback,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useGuestMigration } from './use-guest-migration';

let queryClient: QueryClient;

function Wrapper({ children }: { readonly children: ReactNode }): ReactNode {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.user = { id: 'qa5-user', email: 'qa5@example.com' };
  mocks.accessToken = 'session-token';
  mocks.migrate.mockReset();
  mocks.readActive.mockReset();
  mocks.hasFreshIntent.mockReset();
  mocks.discard.mockReset();
  mocks.toast.mockReset();
  mocks.readActive.mockReturnValue({ id: 'guest-program' });
  mocks.hasFreshIntent.mockReturnValue(true);
  mocks.migrate.mockResolvedValue({ programId: 'gzclp', programName: 'GZCLP' });
});

describe('useGuestMigration', () => {
  it('requires explicit confirmation before importing guest data', async () => {
    const { result } = renderHook(() => useGuestMigration(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.pending).toBe(true));
    expect(result.current.userEmail).toBe('qa5@example.com');
    expect(mocks.migrate).not.toHaveBeenCalled();

    await act(() => result.current.confirmMigration());

    expect(mocks.migrate).toHaveBeenCalledTimes(1);
    expect(mocks.migrate).toHaveBeenCalledWith(
      queryClient,
      { userId: 'qa5-user', sessionId: 'session-token' },
      expect.any(Function)
    );
    expect(mocks.toast).toHaveBeenCalledWith({ message: 'guest_migration.success' });
    expect(result.current.pending).toBe(false);
  });

  it('dismisses without importing or deleting the local copy', async () => {
    const { result } = renderHook(() => useGuestMigration(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.pending).toBe(true));

    act(() => result.current.dismissMigration());

    expect(mocks.discard).not.toHaveBeenCalled();
    expect(mocks.migrate).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
  });

  it('purges guest data with no fresh migration intent instead of prompting', async () => {
    mocks.hasFreshIntent.mockReturnValue(false);
    const { result } = renderHook(() => useGuestMigration(), { wrapper: Wrapper });

    await waitFor(() => expect(mocks.discard).toHaveBeenCalledOnce());
    expect(result.current.pending).toBe(false);
    expect(mocks.migrate).not.toHaveBeenCalled();
  });

  it('requires a fresh confirmation after the authenticated account changes', async () => {
    const { result, rerender } = renderHook(() => useGuestMigration(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.pending).toBe(true));

    mocks.user = null;
    rerender();
    await waitFor(() => expect(result.current.pending).toBe(false));

    mocks.user = { id: 'qa5-user-2', email: 'qa5-2@example.com' };
    mocks.accessToken = 'session-token-2';
    rerender();

    await waitFor(() => expect(result.current.userEmail).toBe('qa5-2@example.com'));
    expect(mocks.migrate).not.toHaveBeenCalled();
  });

  it.each([
    {
      change: 'session',
      update: () => {
        mocks.accessToken = 'replacement-session-token';
      },
    },
    {
      change: 'sign-out',
      update: () => {
        mocks.user = null;
        mocks.accessToken = null;
      },
    },
  ])('aborts stale confirmation after an auth $change', async ({ update }) => {
    const { result } = renderHook(() => useGuestMigration(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.pending).toBe(true));

    update();
    await act(() => result.current.confirmMigration());

    expect(mocks.migrate).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
  });
});
