import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// useGuestMigration — post-login one-shot guest -> account migration.
// The auth/toast contexts and the storage/migration libs are mocked; the
// QueryClient and i18n (initialized to 'es' by test/setup.ts) are real.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn<() => { user: { readonly id: string } | null }>(),
  toast: vi.fn<(opts: { readonly message: string }) => void>(),
  readActiveGuestInstance: vi.fn<() => { readonly programId: string } | null>(),
  migrateGuestDataToAccount:
    vi.fn<() => Promise<{ programId: string; programName: string } | null>>(),
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: mocks.useAuth,
}));
vi.mock('@/contexts/toast-context', () => ({
  useToast: () => ({ toast: mocks.toast, dismiss: vi.fn() }),
}));
vi.mock('@/lib/guest-storage', () => ({
  readActiveGuestInstance: mocks.readActiveGuestInstance,
}));
vi.mock('@/lib/guest-migration', () => ({
  migrateGuestDataToAccount: mocks.migrateGuestDataToAccount,
}));

import { useGuestMigration } from './use-guest-migration';

function createWrapper(): (props: { readonly children: ReactNode }) => ReactNode {
  const client = new QueryClient();
  return ({ children }) => createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Return a FRESH user object on every render so the effect (which depends on
  // `user` by identity) re-runs on each rerender — this makes the tests below
  // exercise the handledRef one-shot guard, not React's dependency memoization.
  mocks.useAuth.mockImplementation(() => ({ user: { id: 'user-1' } }));
  mocks.readActiveGuestInstance.mockReturnValue({ programId: 'gzclp' });
  mocks.migrateGuestDataToAccount.mockResolvedValue({
    programId: 'no-such-program',
    programName: 'Mi Programa',
  });
});

describe('useGuestMigration', () => {
  it('migrates once and shows a localized success toast', async () => {
    renderHook(() => useGuestMigration(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledTimes(1);
    });

    expect(mocks.migrateGuestDataToAccount).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith({
      message: 'Tu programa Mi Programa se ha guardado en tu cuenta.',
    });
  });

  it('does not re-run the migration on a later rerender (one-shot guard)', async () => {
    const { rerender } = renderHook(() => useGuestMigration(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mocks.migrateGuestDataToAccount).toHaveBeenCalledTimes(1);
    });

    rerender();
    await act(async () => {});
    rerender();
    await act(async () => {});

    // The effect re-ran (fresh user identity each render) but the guard held.
    expect(mocks.readActiveGuestInstance).toHaveBeenCalledTimes(1);
    expect(mocks.migrateGuestDataToAccount).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when there is no persisted guest instance', async () => {
    mocks.readActiveGuestInstance.mockReturnValue(null);

    renderHook(() => useGuestMigration(), { wrapper: createWrapper() });
    await act(async () => {});

    expect(mocks.readActiveGuestInstance).toHaveBeenCalled();
    expect(mocks.migrateGuestDataToAccount).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('stays armed after a no-op: migrates when guest data appears on a later render', async () => {
    mocks.readActiveGuestInstance.mockReturnValue(null);
    const { rerender } = renderHook(() => useGuestMigration(), { wrapper: createWrapper() });
    await act(async () => {});
    expect(mocks.migrateGuestDataToAccount).not.toHaveBeenCalled();

    mocks.readActiveGuestInstance.mockReturnValue({ programId: 'gzclp' });
    rerender();

    await waitFor(() => {
      expect(mocks.migrateGuestDataToAccount).toHaveBeenCalledTimes(1);
    });
  });

  it('does nothing while logged out', async () => {
    mocks.useAuth.mockImplementation(() => ({ user: null }));

    renderHook(() => useGuestMigration(), { wrapper: createWrapper() });
    await act(async () => {});

    expect(mocks.readActiveGuestInstance).not.toHaveBeenCalled();
    expect(mocks.migrateGuestDataToAccount).not.toHaveBeenCalled();
  });

  it('does not toast when the migration reports nothing migrated (null result)', async () => {
    mocks.migrateGuestDataToAccount.mockResolvedValue(null);

    renderHook(() => useGuestMigration(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mocks.migrateGuestDataToAccount).toHaveBeenCalledTimes(1);
    });
    await act(async () => {});

    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('swallows a migration rejection, logging a console.warn instead of throwing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.migrateGuestDataToAccount.mockRejectedValue(new Error('network down'));

    renderHook(() => useGuestMigration(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        '[guest-migration] Unexpected migration error:',
        'network down'
      );
    });
    expect(mocks.toast).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
