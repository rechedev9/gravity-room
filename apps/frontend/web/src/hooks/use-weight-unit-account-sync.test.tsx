import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { UserInfo } from '@gzclp/domain/schemas/user';

const { mockUpdateProfile } = vi.hoisted(() => ({
  mockUpdateProfile: vi.fn<(fields: { weightUnit?: 'kg' | 'lbs' }) => Promise<UserInfo>>(),
}));

vi.mock('@/lib/api-core', () => ({ updateProfile: mockUpdateProfile }));

import { useWeightUnitAccountSync } from './use-weight-unit-account-sync';
import {
  WEIGHT_UNIT_OWNER_KEY,
  WEIGHT_UNIT_STORAGE_KEY,
  readWeightUnit,
  writeWeightUnit,
} from '@/lib/weight-unit';

const USER: UserInfo = { id: 'u1', email: 'a@b.co', weightUnit: 'kg' };

function mount(user: UserInfo | null): () => void {
  const client = new QueryClient();
  const { unmount } = renderHook(() => useWeightUnitAccountSync(user), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  return unmount;
}

beforeEach(() => {
  mockUpdateProfile.mockReset();
  mockUpdateProfile.mockImplementation((fields) =>
    Promise.resolve({ ...USER, ...(fields.weightUnit ? { weightUnit: fields.weightUnit } : {}) })
  );
});

afterEach(() => {
  localStorage.clear();
});

describe('useWeightUnitAccountSync', () => {
  it('adopts the account unit on a new device without writing anything back', () => {
    mount({ ...USER, weightUnit: 'lbs' });
    expect(readWeightUnit()).toBe('lbs');
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('pushes a unit chosen as a guest to the account exactly once', async () => {
    localStorage.setItem(WEIGHT_UNIT_STORAGE_KEY, 'lbs');
    const unmount = mount(USER);
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledWith({ weightUnit: 'lbs' }));
    expect(localStorage.getItem(WEIGHT_UNIT_OWNER_KEY)).toBe('u1');
    expect(readWeightUnit()).toBe('lbs');

    unmount();
    mount({ ...USER, weightUnit: 'lbs' });
    expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
  });

  it('lets the account win once the browser has been reconciled with it', () => {
    localStorage.setItem(WEIGHT_UNIT_STORAGE_KEY, 'lbs');
    localStorage.setItem(WEIGHT_UNIT_OWNER_KEY, 'u1');
    mount(USER);
    expect(readWeightUnit()).toBe('kg');
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('does not leak the previous account choice into another account', () => {
    localStorage.setItem(WEIGHT_UNIT_STORAGE_KEY, 'lbs');
    localStorage.setItem(WEIGHT_UNIT_OWNER_KEY, 'someone-else');
    mount(USER);
    expect(readWeightUnit()).toBe('kg');
    expect(localStorage.getItem(WEIGHT_UNIT_OWNER_KEY)).toBe('u1');
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('writes a later change to the account', async () => {
    mount(USER);
    act(() => writeWeightUnit('lbs'));
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenCalledWith({ weightUnit: 'lbs' }));
  });

  it('stays local for guests and for an API that sends no unit', () => {
    localStorage.setItem(WEIGHT_UNIT_STORAGE_KEY, 'lbs');
    mount(null);
    mount({ id: 'u1', email: 'a@b.co' });
    act(() => writeWeightUnit('kg'));
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(localStorage.getItem(WEIGHT_UNIT_OWNER_KEY)).toBeNull();
  });
});
