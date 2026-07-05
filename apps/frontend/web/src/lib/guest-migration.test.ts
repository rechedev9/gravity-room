/**
 * guest-migration.test.ts - unit tests for migrateGuestDataToAccount.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockImportProgram, mockFetchPrograms } = vi.hoisted(() => ({
  mockImportProgram: vi.fn(),
  mockFetchPrograms: vi.fn(),
}));

vi.mock('@/lib/api-functions', async () => {
  const { apiFunctionsStubs } = await import('../../test/helpers/api-functions-mock');
  return {
    ...apiFunctionsStubs,
    importProgram: mockImportProgram,
    fetchPrograms: mockFetchPrograms,
  };
});

import { QueryClient } from '@tanstack/react-query';
import type { ProgramInstanceMap } from '@gzclp/domain/types/program';
import { GUEST_STORAGE_KEY } from '@/lib/guest-storage';
import { migrateGuestDataToAccount } from './guest-migration';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function guestMapWithProgram(): ProgramInstanceMap {
  return {
    version: 1,
    activeProgramId: 'guest',
    instances: {
      guest: {
        id: 'guest',
        programId: 'gzclp',
        name: 'GZCLP',
        config: { squat: 60, bench: 40 },
        results: {
          '0': {
            'squat-t1': { result: 'success', amrapReps: 5, setLogs: [{ reps: 5 }] },
            'bench-t1': { result: 'fail' },
            'lat-t3': {}, // no recorded pass/fail — must be excluded from the payload
          },
          '1': {
            'dead-t1': { result: 'success', rpe: 8 },
          },
        },
        undoHistory: [],
        status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    },
  };
}

function seedGuest(map: ProgramInstanceMap): void {
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(map));
}

function freshQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => {
  localStorage.clear();
  mockImportProgram.mockReset();
  mockFetchPrograms.mockReset();
  mockFetchPrograms.mockResolvedValue([]);
  mockImportProgram.mockResolvedValue({
    id: 'server-instance-1',
    programId: 'gzclp',
    name: 'GZCLP',
    config: {},
    status: 'active',
    createdAt: '',
    updatedAt: '',
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('migrateGuestDataToAccount', () => {
  it('returns null and does nothing when there is no guest data', async () => {
    const result = await migrateGuestDataToAccount(freshQueryClient());

    expect(result).toBeNull();
    expect(mockImportProgram).not.toHaveBeenCalled();
  });

  it('returns null when there is no active guest instance', async () => {
    seedGuest({ version: 1, activeProgramId: null, instances: {} });

    const result = await migrateGuestDataToAccount(freshQueryClient());

    expect(result).toBeNull();
    expect(mockImportProgram).not.toHaveBeenCalled();
  });

  it('imports the guest program atomically with only recorded results', async () => {
    seedGuest(guestMapWithProgram());

    const result = await migrateGuestDataToAccount(freshQueryClient());

    expect(mockImportProgram).toHaveBeenCalledTimes(1);
    const payload = mockImportProgram.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      version: 1,
      programId: 'gzclp',
      name: 'GZCLP',
      config: { squat: 60, bench: 40 },
      results: {
        '0': {
          // setLogs is client-side only and must be stripped from the payload.
          'squat-t1': { result: 'success', amrapReps: 5 },
          'bench-t1': { result: 'fail' },
        },
        '1': {
          'dead-t1': { result: 'success', rpe: 8 },
        },
      },
      undoHistory: [],
    });
    const workout0 = (payload.results as Record<string, Record<string, unknown>>)['0'];
    expect(workout0 && 'lat-t3' in workout0).toBe(false);
    expect(workout0 && 'setLogs' in (workout0['squat-t1'] as Record<string, unknown>)).toBe(false);
    expect(typeof payload.exportDate).toBe('string');
    expect(result).toEqual({ programId: 'gzclp', programName: 'GZCLP' });
  });

  it('clears guest storage after a successful migration', async () => {
    seedGuest(guestMapWithProgram());

    await migrateGuestDataToAccount(freshQueryClient());

    expect(localStorage.getItem(GUEST_STORAGE_KEY)).toBeNull();
  });

  it('skips migration and keeps guest data when the account already has an active program', async () => {
    seedGuest(guestMapWithProgram());
    mockFetchPrograms.mockResolvedValue([
      { id: 'p1', programId: 'gzclp', name: 'Mine', config: {}, status: 'active' },
    ]);

    const result = await migrateGuestDataToAccount(freshQueryClient());

    expect(result).toBeNull();
    expect(mockImportProgram).not.toHaveBeenCalled();
    expect(localStorage.getItem(GUEST_STORAGE_KEY)).not.toBeNull();
  });

  it('migrates when the account only has non-active programs', async () => {
    seedGuest(guestMapWithProgram());
    mockFetchPrograms.mockResolvedValue([
      { id: 'p1', programId: 'gzclp', name: 'Old', config: {}, status: 'completed' },
    ]);

    const result = await migrateGuestDataToAccount(freshQueryClient());

    expect(result).not.toBeNull();
    expect(mockImportProgram).toHaveBeenCalledTimes(1);
  });

  it('keeps guest data and returns null when the program list cannot be fetched', async () => {
    seedGuest(guestMapWithProgram());
    mockFetchPrograms.mockRejectedValue(new Error('network'));

    const result = await migrateGuestDataToAccount(freshQueryClient());

    expect(result).toBeNull();
    expect(mockImportProgram).not.toHaveBeenCalled();
    expect(localStorage.getItem(GUEST_STORAGE_KEY)).not.toBeNull();
  });

  it('keeps guest data and returns null when the import fails', async () => {
    seedGuest(guestMapWithProgram());
    mockImportProgram.mockRejectedValueOnce(new Error('network'));

    const result = await migrateGuestDataToAccount(freshQueryClient());

    expect(result).toBeNull();
    // Guest data survives so migration can be retried on a later sign-in.
    expect(localStorage.getItem(GUEST_STORAGE_KEY)).not.toBeNull();
  });
});
