/**
 * use-dashboard-data.test.ts - verifies the hook fetches the active program's
 * detail + definition (mocked queries) and derives the dashboard view models.
 */
import { vi, describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import type { ProgramSummary } from '@/lib/api-functions';

// Fixtures the vi.mock factory reads must be created via vi.hoisted - vi.mock is
// hoisted above the imports, so plain module-scope consts would be in their TDZ
// when the factory runs (see use-program.test.ts for the same pattern).
const h = vi.hoisted(() => {
  const DEFINITION: ProgramDefinition = {
    id: 'test-prog',
    name: 'Test Program',
    description: 'Fixture.',
    author: 'test',
    version: 1,
    category: 'strength',
    source: 'preset',
    cycleLength: 2,
    totalWorkouts: 4,
    workoutsPerWeek: 2,
    exercises: { squat: { name: 'Squat' }, bench: { name: 'Bench' } },
    configFields: [
      { key: 'squat', label: 'Squat', type: 'weight', min: 20, step: 2.5 },
      { key: 'bench', label: 'Bench', type: 'weight', min: 20, step: 2.5 },
    ],
    weightIncrements: { squat: 5, bench: 2.5 },
    days: [
      {
        name: 'Day A',
        slots: [
          {
            id: 'squat-t1',
            exerciseId: 'squat',
            tier: 't1',
            stages: [{ sets: 3, reps: 5, amrap: false }],
            onSuccess: { type: 'add_weight' },
            onMidStageFail: { type: 'no_change' },
            onFinalStageFail: { type: 'no_change' },
            startWeightKey: 'squat',
          },
        ],
      },
      {
        name: 'Day B',
        slots: [
          {
            id: 'bench-t1',
            exerciseId: 'bench',
            tier: 't1',
            stages: [{ sets: 3, reps: 5, amrap: false }],
            onSuccess: { type: 'add_weight' },
            onMidStageFail: { type: 'no_change' },
            onFinalStageFail: { type: 'no_change' },
            startWeightKey: 'bench',
          },
        ],
      },
    ],
  };

  const DETAIL = {
    id: 'inst-1',
    programId: 'test-prog',
    name: 'Test Program',
    config: { squat: 100, bench: 60 },
    metadata: null,
    results: {
      0: { 'squat-t1': { result: 'success' } },
      1: { 'bench-t1': { result: 'success' } },
    },
    undoHistory: [],
    resultTimestamps: { '0': '2025-01-01T00:00:00Z', '1': '2025-01-02T00:00:00Z' },
    completedDates: {},
    definitionId: null,
    customDefinition: null,
    status: 'active',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-02',
  };

  return { DEFINITION, DETAIL };
});

vi.mock('@/lib/api-functions', async () => {
  const { apiFunctionsStubs } = await import('../../../test/helpers/api-functions-mock');
  return {
    ...apiFunctionsStubs,
    fetchGenericProgramDetail: vi.fn(() => Promise.resolve(h.DETAIL)),
    fetchCatalogDetail: vi.fn(() => Promise.resolve(h.DEFINITION)),
  };
});

import { useDashboardData } from './use-dashboard-data';

const PROGRAM_SUMMARY: ProgramSummary = {
  id: 'inst-1',
  programId: 'test-prog',
  name: 'Test Program',
  config: {},
  status: 'active',
  createdAt: '2025-01-01',
  updatedAt: '2025-01-02',
};

function createWrapper(): React.FC<{ readonly children: React.ReactNode }> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { readonly children: React.ReactNode }): React.ReactNode {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useDashboardData', () => {
  it('returns empty, non-loading view models when there is no active program', () => {
    const { result } = renderHook(() => useDashboardData(null), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hero).toEqual({});
    expect(result.current.recentSessions).toHaveLength(0);
    expect(result.current.liftHistory).toHaveLength(0);
  });

  it('derives hero, recent sessions and PR-road history from logged sets', async () => {
    const { result } = renderHook(() => useDashboardData(PROGRAM_SUMMARY), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.recentSessions.length).toBeGreaterThan(0);
    });

    expect(result.current.hero.nextSet).toEqual({ weight: 105, reps: 5, label: 'Squat' });
    expect(result.current.hero.nextWorkout).toMatchObject({ dayIndex: 2, totalDays: 4 });
    expect(result.current.recentSessions).toHaveLength(2);
    expect(result.current.liftHistory).toContainEqual({
      lift: 'Bench',
      weight: 60,
      prTarget: 62.5,
      isPr: false,
    });
  });
});
