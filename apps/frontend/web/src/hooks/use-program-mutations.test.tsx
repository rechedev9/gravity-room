import { describe, expect, it, mock } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import type { GenericProgramDetail } from '@/lib/api-functions';
import { queryKeys } from '@/lib/query-keys';

const mockRecordGenericResult = mock(() => Promise.resolve());

mock.module('@/lib/api-functions', () => ({
  recordGenericResult: mockRecordGenericResult,
  createProgram: mock(() => Promise.resolve()),
  updateProgramConfig: mock(() => Promise.resolve()),
  updateProgramMetadata: mock(() => Promise.resolve()),
  completeProgram: mock(() => Promise.resolve()),
  deleteProgram: mock(() => Promise.resolve()),
  deleteGenericResult: mock(() => Promise.resolve()),
  undoLastResult: mock(() => Promise.resolve()),
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
});
