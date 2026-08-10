import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import type { GenericProgramDetail } from '@/lib/api-functions';
import { queryKeys } from '@/lib/query-keys';

// vi.mock is hoisted above imports, so the mock fn the test asserts on must be
// created via vi.hoisted to exist before the factory runs.
const { mockRecordGenericResult, mockDeleteGenericResult, mockUndoLastResult } = vi.hoisted(() => ({
  mockRecordGenericResult: vi.fn(() => Promise.resolve()),
  mockDeleteGenericResult: vi.fn(() => Promise.resolve()),
  mockUndoLastResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/api-functions', () => ({
  recordGenericResult: mockRecordGenericResult,
  createProgram: vi.fn(() => Promise.resolve()),
  updateProgramConfig: vi.fn(() => Promise.resolve()),
  updateProgramMetadata: vi.fn(() => Promise.resolve()),
  completeProgram: vi.fn(() => Promise.resolve()),
  deleteProgram: vi.fn(() => Promise.resolve()),
  deleteGenericResult: mockDeleteGenericResult,
  undoLastResult: mockUndoLastResult,
}));

import { useProgramMutations } from './use-program-mutations';

const DETAIL_KEY = queryKeys.programs.detail('inst-1');

const DETAIL: GenericProgramDetail = {
  id: 'inst-1',
  programId: 'gzclp',
  name: 'GZCLP',
  config: {},
  metadata: null,
  status: 'active',
  results: {},
  undoHistory: [],
  resultTimestamps: {},
  completedDates: {},
  definitionId: 'gzclp',
  customDefinition: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderProgramMutations(queryClient: QueryClient) {
  return renderHook(
    () =>
      useProgramMutations({
        activeInstanceId: 'inst-1',
        programId: 'gzclp',
        definition: undefined,
        queryClient,
        toast: () => undefined,
        t: (key: string) => key,
      }),
    {
      wrapper: ({ children }: { readonly children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children),
    }
  );
}

describe('useProgramMutations', () => {
  it('keeps result marking responsive by not invalidating detail immediately', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(DETAIL_KEY, DETAIL);

    const { result } = renderProgramMutations(queryClient);

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    await result.current.markResultMutation.mutateAsync({
      index: 0,
      slotId: 'squat-t1',
      value: 'success',
    });

    expect(
      queryClient.getQueryData<GenericProgramDetail>(DETAIL_KEY)?.results['0']?.['squat-t1']
    ).toEqual({ result: 'success' });
    expect(queryClient.getQueryState(DETAIL_KEY)?.isInvalidated).toBe(false);
    expect(mockRecordGenericResult).toHaveBeenCalledTimes(1);
  });

  it('rolls back a failed AMRAP save to the pre-edit server value, not the failed optimistic one', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    // Server-confirmed state before the user touches AMRAP: result recorded, no reps yet.
    const serverConfirmed: GenericProgramDetail = {
      ...DETAIL,
      results: { '0': { 'squat-t1': { result: 'success' } } },
    };
    queryClient.setQueryData(DETAIL_KEY, serverConfirmed);

    mockRecordGenericResult.mockRejectedValueOnce(new Error('network error'));

    const { result } = renderProgramMutations(queryClient);
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // Mirrors what use-program.ts's patchSlotField does synchronously before the
    // debounced mutate: apply the optimistic value to the cache immediately, then
    // fire the mutation with the true pre-edit value (8, i.e. `undefined` here)
    // threaded through as `previousReps`.
    queryClient.setQueryData<GenericProgramDetail>(DETAIL_KEY, (prev) =>
      prev
        ? { ...prev, results: { '0': { 'squat-t1': { result: 'success', amrapReps: 8 } } } }
        : prev
    );

    await expect(
      result.current.setAmrapMutation.mutateAsync({
        index: 0,
        slotId: 'squat-t1',
        reps: 8,
        previousReps: undefined,
      })
    ).rejects.toThrow();

    // The failed save must not leave the never-persisted "8" reps behind — it
    // must restore the last server-confirmed value (no amrapReps field at all).
    expect(
      queryClient.getQueryData<GenericProgramDetail>(DETAIL_KEY)?.results['0']?.['squat-t1']
    ).toEqual({ result: 'success' });
  });

  it('optimistically stores setLogs when marking a result from sequential logging', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(DETAIL_KEY, DETAIL);

    const { result } = renderProgramMutations(queryClient);
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    const setLogs = [{ reps: 3 }, { reps: 3 }, { reps: 3 }, { reps: 3 }, { reps: 8 }];
    await result.current.markResultMutation.mutateAsync({
      index: 0,
      slotId: 'd1-t1',
      value: 'success',
      setLogs,
    });

    expect(
      queryClient.getQueryData<GenericProgramDetail>(DETAIL_KEY)?.results['0']?.['d1-t1']
    ).toEqual({ result: 'success', setLogs });
    expect(mockRecordGenericResult).toHaveBeenCalledWith(
      'inst-1',
      0,
      'd1-t1',
      'success',
      undefined,
      undefined,
      setLogs
    );
  });

  it('rolls back an optimistic mark when the API call fails', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(DETAIL_KEY, DETAIL);
    mockRecordGenericResult.mockRejectedValueOnce(new Error('network error'));

    const { result } = renderProgramMutations(queryClient);
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    await expect(
      result.current.markResultMutation.mutateAsync({
        index: 0,
        slotId: 'd1-t1',
        value: 'fail',
      })
    ).rejects.toThrow();

    expect(
      queryClient.getQueryData<GenericProgramDetail>(DETAIL_KEY)?.results['0']?.['d1-t1']
    ).toBeUndefined();
  });

  it('optimistically undoes the last result via the undo stack snapshot', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const withHistory: GenericProgramDetail = {
      ...DETAIL,
      results: {
        '0': {
          'd1-t1': { result: 'success', amrapReps: 10 },
          'd1-t2': { result: 'fail' },
        },
      },
      undoHistory: [
        { i: 0, slotId: 'd1-t1', prev: undefined },
        { i: 0, slotId: 'd1-t2', prev: undefined },
      ],
    };
    queryClient.setQueryData(DETAIL_KEY, withHistory);

    const { result } = renderProgramMutations(queryClient);
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    await result.current.undoLastMutation.mutateAsync();

    const detail = queryClient.getQueryData<GenericProgramDetail>(DETAIL_KEY);
    expect(detail?.results['0']?.['d1-t2']).toBeUndefined();
    expect(detail?.results['0']?.['d1-t1']).toEqual({ result: 'success', amrapReps: 10 });
    expect(detail?.undoHistory).toEqual([{ i: 0, slotId: 'd1-t1', prev: undefined }]);
    expect(mockUndoLastResult).toHaveBeenCalledWith('inst-1');
  });

  it('optimistically restores a previous snapshot when undoing an overwrite', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const withHistory: GenericProgramDetail = {
      ...DETAIL,
      results: {
        '0': { 'd1-t1': { result: 'fail', setLogs: [{ reps: 2 }] } },
      },
      undoHistory: [
        {
          i: 0,
          slotId: 'd1-t1',
          prev: 'success',
          prevAmrapReps: 12,
          prevSetLogs: [{ reps: 3 }, { reps: 3 }, { reps: 3 }, { reps: 3 }, { reps: 12 }],
        },
      ],
    };
    queryClient.setQueryData(DETAIL_KEY, withHistory);

    const { result } = renderProgramMutations(queryClient);
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    await result.current.undoLastMutation.mutateAsync();

    expect(
      queryClient.getQueryData<GenericProgramDetail>(DETAIL_KEY)?.results['0']?.['d1-t1']
    ).toEqual({
      result: 'success',
      amrapReps: 12,
      setLogs: [{ reps: 3 }, { reps: 3 }, { reps: 3 }, { reps: 3 }, { reps: 12 }],
    });
  });

  it('optimistically removes a specific slot result on badge undo', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(DETAIL_KEY, {
      ...DETAIL,
      results: {
        '0': {
          'd1-t1': { result: 'success' },
          'd1-t2': { result: 'fail' },
        },
      },
    });

    const { result } = renderProgramMutations(queryClient);
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    await result.current.undoSpecificMutation.mutateAsync({ index: 0, slotId: 'd1-t1' });

    const detail = queryClient.getQueryData<GenericProgramDetail>(DETAIL_KEY);
    expect(detail?.results['0']?.['d1-t1']).toBeUndefined();
    expect(detail?.results['0']?.['d1-t2']).toEqual({ result: 'fail' });
    expect(mockDeleteGenericResult).toHaveBeenCalledWith('inst-1', 0, 'd1-t1');
  });
});
