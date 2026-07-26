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
    migrate: vi.fn(),
    readActive: vi.fn(),
    toast: vi.fn(),
  },
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: mocks.user }),
}));
vi.mock('@/contexts/toast-context', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));
vi.mock('@/lib/guest-storage', () => ({
  readActiveGuestInstance: mocks.readActive,
}));
vi.mock('@/lib/guest-migration', () => ({
  migrateGuestDataToAccount: mocks.migrate,
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
  mocks.migrate.mockReset();
  mocks.readActive.mockReset();
  mocks.toast.mockReset();
  mocks.readActive.mockReturnValue({ id: 'guest-program' });
});

describe('useGuestMigration', () => {
  it('retries retained guest data on the next online transition', async () => {
    mocks.migrate
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ programId: 'gzclp', programName: 'GZCLP' });

    renderHook(() => useGuestMigration(), { wrapper: Wrapper });
    await waitFor(() => expect(mocks.migrate).toHaveBeenCalledTimes(1));

    act(() => window.dispatchEvent(new Event('online')));

    await waitFor(() => expect(mocks.migrate).toHaveBeenCalledTimes(2));
    expect(mocks.toast).toHaveBeenCalledOnce();
  });

  it('allows a new authenticated session to run its own migration', async () => {
    mocks.migrate.mockResolvedValue(null);
    const { rerender } = renderHook(() => useGuestMigration(), { wrapper: Wrapper });
    await waitFor(() => expect(mocks.migrate).toHaveBeenCalledTimes(1));

    mocks.user = null;
    rerender();
    mocks.user = { id: 'qa5-user-2', email: 'qa5-2@example.com' };
    rerender();

    await waitFor(() => expect(mocks.migrate).toHaveBeenCalledTimes(2));
  });
});
