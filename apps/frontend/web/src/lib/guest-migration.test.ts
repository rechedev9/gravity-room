/**
 * guest-migration.test.ts — unit tests for migrateGuestDataToAccount.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockCreateProgram, mockRecordGenericResult } = vi.hoisted(() => ({
  mockCreateProgram: vi.fn(),
  mockRecordGenericResult: vi.fn(),
}));

vi.mock('@/lib/api-functions', async () => {
  const { apiFunctionsStubs } = await import('../../test/helpers/api-functions-mock');
  return {
    ...apiFunctionsStubs,
    createProgram: mockCreateProgram,
    recordGenericResult: mockRecordGenericResult,
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
            'squat-t1': { result: 'success', amrapReps: 5 },
            'bench-t1': { result: 'fail' },
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

beforeEach(() => {
  localStorage.clear();
  mockCreateProgram.mockReset();
  mockRecordGenericResult.mockReset();
  mockCreateProgram.mockResolvedValue({
    id: 'server-instance-1',
    programId: 'gzclp',
    name: 'GZCLP',
    config: {},
    status: 'active',
    createdAt: '',
    updatedAt: '',
  });
  mockRecordGenericResult.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('migrateGuestDataToAccount', () => {
  it('returns null and does nothing when there is no guest data', async () => {
    const result = await migrateGuestDataToAccount(new QueryClient());

    expect(result).toBeNull();
    expect(mockCreateProgram).not.toHaveBeenCalled();
  });

  it('returns null when there is no active guest instance', async () => {
    seedGuest({ version: 1, activeProgramId: null, instances: {} });

    const result = await migrateGuestDataToAccount(new QueryClient());

    expect(result).toBeNull();
    expect(mockCreateProgram).not.toHaveBeenCalled();
  });

  it('creates the program with the guest name and config', async () => {
    seedGuest(guestMapWithProgram());

    await migrateGuestDataToAccount(new QueryClient());

    expect(mockCreateProgram).toHaveBeenCalledTimes(1);
    expect(mockCreateProgram).toHaveBeenCalledWith('gzclp', 'GZCLP', { squat: 60, bench: 40 });
  });

  it('replays every recorded result against the new server instance', async () => {
    seedGuest(guestMapWithProgram());

    const result = await migrateGuestDataToAccount(new QueryClient());

    expect(mockRecordGenericResult).toHaveBeenCalledTimes(3);
    expect(mockRecordGenericResult).toHaveBeenCalledWith(
      'server-instance-1',
      0,
      'squat-t1',
      'success',
      5,
      undefined,
      undefined
    );
    expect(mockRecordGenericResult).toHaveBeenCalledWith(
      'server-instance-1',
      0,
      'bench-t1',
      'fail',
      undefined,
      undefined,
      undefined
    );
    expect(mockRecordGenericResult).toHaveBeenCalledWith(
      'server-instance-1',
      1,
      'dead-t1',
      'success',
      undefined,
      8,
      undefined
    );
    expect(result).toEqual({
      programId: 'gzclp',
      programName: 'GZCLP',
      migratedResults: 3,
      failedResults: 0,
    });
  });

  it('clears guest storage after a successful migration', async () => {
    seedGuest(guestMapWithProgram());

    await migrateGuestDataToAccount(new QueryClient());

    expect(localStorage.getItem(GUEST_STORAGE_KEY)).toBeNull();
  });

  it('keeps guest data and returns null when program creation fails', async () => {
    seedGuest(guestMapWithProgram());
    mockCreateProgram.mockRejectedValueOnce(new Error('network'));

    const result = await migrateGuestDataToAccount(new QueryClient());

    expect(result).toBeNull();
    expect(mockRecordGenericResult).not.toHaveBeenCalled();
    // Guest data survives so migration can be retried on a later sign-in.
    expect(localStorage.getItem(GUEST_STORAGE_KEY)).not.toBeNull();
  });

  it('tolerates individual result failures and still clears guest data', async () => {
    seedGuest(guestMapWithProgram());
    mockRecordGenericResult
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('one failed'))
      .mockResolvedValueOnce(undefined);

    const result = await migrateGuestDataToAccount(new QueryClient());

    expect(result).toEqual({
      programId: 'gzclp',
      programName: 'GZCLP',
      migratedResults: 2,
      failedResults: 1,
    });
    expect(localStorage.getItem(GUEST_STORAGE_KEY)).toBeNull();
  });
});
