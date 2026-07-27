import type { ProgramDefinition } from '@gzclp/domain';

import {
  buildDefaultProgramConfig,
  createProgramInstance,
  deleteProgramInstance,
  fetchCatalogDefinition,
  fetchCatalogEntries,
  fetchProgramSummaries,
  updateProgramInstance,
} from './program-service';

const mockGetAccessToken = jest.fn<string | null, []>();
const mockFetchWithAccessToken = jest.fn<
  Promise<{ readonly accessToken: string; readonly response: Response }>,
  [string, RequestInit | undefined]
>();
const MOCK_OPAQUE_VALUE = 'opaque-test-value';

jest.mock('../auth/session', () => ({
  getAccessToken: () => mockGetAccessToken(),
  fetchWithAccessToken: (path: string, init?: RequestInit) => mockFetchWithAccessToken(path, init),
}));

const DEFINITION = {
  id: 'gzclp',
  name: 'GZCLP',
  description: 'Linear progression',
  author: 'Gravity Room',
  version: 1,
  category: 'strength',
  source: 'preset',
  days: [
    {
      name: 'Day 1',
      slots: [
        {
          id: 'squat-t1',
          exerciseId: 'squat',
          tier: 'T1',
          stages: [{ sets: 5, reps: 3 }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'squat',
        },
      ],
    },
  ],
  cycleLength: 1,
  totalWorkouts: 12,
  workoutsPerWeek: 3,
  exercises: { squat: { name: 'Squat' } },
  configFields: [
    { key: 'squat', label: 'Squat', type: 'weight', min: 20, step: 2.5 },
    {
      key: 'variant',
      label: 'Variant',
      type: 'select',
      options: [{ label: 'Classic', value: 'classic' }],
    },
  ],
  weightIncrements: { T1: 2.5 },
} satisfies ProgramDefinition;

const DETAIL = {
  id: '11111111-1111-4111-8111-111111111111',
  programId: 'gzclp',
  name: 'GZCLP',
  config: { squat: 20, variant: 'classic' },
  metadata: null,
  results: {},
  undoHistory: [],
  resultTimestamps: {},
  completedDates: {},
  definitionId: null,
  customDefinition: null,
  status: 'active',
  createdAt: '2026-07-27T10:00:00.000Z',
  updatedAt: '2026-07-27T10:00:00.000Z',
};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('program API service', () => {
  beforeEach(() => {
    mockGetAccessToken.mockReturnValue(MOCK_OPAQUE_VALUE);
  });

  afterEach(() => {
    mockGetAccessToken.mockReset();
    mockFetchWithAccessToken.mockReset();
  });

  it('parses all paginated lifecycle summaries without permissive defaults', async () => {
    mockFetchWithAccessToken
      .mockResolvedValueOnce({
        accessToken: MOCK_OPAQUE_VALUE,
        response: jsonResponse({
          data: [
            {
              id: 'program-a',
              programId: 'gzclp',
              name: 'Strength Base',
              status: 'active',
              createdAt: '2026-07-27T08:00:00.000Z',
              updatedAt: '2026-07-27T10:00:00.000Z',
            },
          ],
          nextCursor: 'cursor-2',
        }),
      })
      .mockResolvedValueOnce({
        accessToken: MOCK_OPAQUE_VALUE,
        response: jsonResponse({
          data: [
            {
              id: 'program-b',
              programId: 'gzclp',
              name: 'Old Block',
              status: 'archived',
              createdAt: '2026-07-20T08:00:00.000Z',
              updatedAt: '2026-07-26T10:00:00.000Z',
            },
          ],
          nextCursor: null,
        }),
      });

    await expect(fetchProgramSummaries()).resolves.toEqual([
      {
        id: 'program-a',
        programId: 'gzclp',
        title: 'Strength Base',
        status: 'active',
        createdAt: '2026-07-27T08:00:00.000Z',
        updatedAt: '2026-07-27T10:00:00.000Z',
      },
      {
        id: 'program-b',
        programId: 'gzclp',
        title: 'Old Block',
        status: 'archived',
        createdAt: '2026-07-20T08:00:00.000Z',
        updatedAt: '2026-07-26T10:00:00.000Z',
      },
    ]);
    expect(mockFetchWithAccessToken).toHaveBeenNthCalledWith(
      2,
      '/programs?cursor=cursor-2',
      undefined
    );
  });

  it('rejects malformed or unknown lifecycle summaries at the network boundary', async () => {
    mockFetchWithAccessToken.mockResolvedValue({
      accessToken: MOCK_OPAQUE_VALUE,
      response: jsonResponse({
        data: [
          {
            id: 'program-a',
            programId: 'gzclp',
            name: 'Broken',
            status: 'paused',
            createdAt: '2026-07-27T08:00:00.000Z',
            updatedAt: '2026-07-27T10:00:00.000Z',
          },
        ],
        nextCursor: null,
      }),
    });

    await expect(fetchProgramSummaries()).rejects.toThrow();
  });

  it('fetches catalog list and validated ProgramDefinition detail', async () => {
    mockFetchWithAccessToken
      .mockResolvedValueOnce({
        accessToken: MOCK_OPAQUE_VALUE,
        response: jsonResponse([
          {
            id: 'gzclp',
            name: 'GZCLP',
            description: 'Linear progression',
            author: 'Gravity Room',
            category: 'strength',
            level: 'beginner',
            source: 'preset',
            totalWorkouts: 12,
            workoutsPerWeek: 3,
            cycleLength: 1,
          },
        ]),
      })
      .mockResolvedValueOnce({
        accessToken: MOCK_OPAQUE_VALUE,
        response: jsonResponse(DEFINITION),
      });

    await expect(fetchCatalogEntries()).resolves.toHaveLength(1);
    await expect(fetchCatalogDefinition('gzclp')).resolves.toEqual(DEFINITION);
    expect(mockFetchWithAccessToken).toHaveBeenNthCalledWith(2, '/catalog/gzclp', undefined);
  });

  it('builds a valid default for every definition field', () => {
    expect(buildDefaultProgramConfig(DEFINITION)).toEqual({
      squat: 20,
      variant: 'classic',
    });
  });

  it('blocks invalid setup before the online-only POST', async () => {
    await expect(
      createProgramInstance({
        definition: DEFINITION,
        name: 'GZCLP',
        config: { squat: 21, variant: 'classic' },
      })
    ).rejects.toThrow('Program creation requires valid setup');
    expect(mockFetchWithAccessToken).not.toHaveBeenCalled();
  });

  it('creates, renames, changes lifecycle and deletes through explicit HTTP methods', async () => {
    mockFetchWithAccessToken
      .mockResolvedValueOnce({
        accessToken: MOCK_OPAQUE_VALUE,
        response: jsonResponse(DETAIL, 201),
      })
      .mockResolvedValueOnce({
        accessToken: MOCK_OPAQUE_VALUE,
        response: jsonResponse({ ...DETAIL, name: 'Renamed' }),
      })
      .mockResolvedValueOnce({
        accessToken: MOCK_OPAQUE_VALUE,
        response: jsonResponse({ ...DETAIL, status: 'archived' }),
      })
      .mockResolvedValueOnce({
        accessToken: MOCK_OPAQUE_VALUE,
        response: new Response(null, { status: 204 }),
      });

    await createProgramInstance({
      definition: DEFINITION,
      name: 'GZCLP',
      config: { squat: 20, variant: 'classic' },
    });
    await updateProgramInstance(DETAIL.id, { type: 'rename', name: ' Renamed ' });
    await updateProgramInstance(DETAIL.id, {
      type: 'set_status',
      status: 'archived',
    });
    await deleteProgramInstance(DETAIL.id);

    expect(mockFetchWithAccessToken).toHaveBeenNthCalledWith(1, '/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        programId: 'gzclp',
        name: 'GZCLP',
        config: { squat: 20, variant: 'classic' },
      }),
    });
    expect(mockFetchWithAccessToken).toHaveBeenNthCalledWith(2, `/programs/${DETAIL.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed' }),
    });
    expect(mockFetchWithAccessToken).toHaveBeenNthCalledWith(4, `/programs/${DETAIL.id}`, {
      method: 'DELETE',
    });
  });

  it.each(['active', 'completed', 'archived'] as const)(
    'sends the canonical %s lifecycle status',
    async (status) => {
      mockFetchWithAccessToken.mockResolvedValue({
        accessToken: MOCK_OPAQUE_VALUE,
        response: jsonResponse({ ...DETAIL, status }),
      });

      await expect(
        updateProgramInstance(DETAIL.id, { type: 'set_status', status })
      ).resolves.toMatchObject({ status });
      expect(mockFetchWithAccessToken).toHaveBeenCalledWith(`/programs/${DETAIL.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    }
  );
});
