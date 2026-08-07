import {
  buildDefaultProgramConfig,
  createProgramInstance,
  fetchCatalogDefinition,
  fetchCatalogEntries,
  fetchProgramSummaries,
} from './program-service';
import type { ApiRequestOptions } from '@gzclp/api-client/transport';

const mockFetchWithAccessToken = jest.fn<
  Promise<{ readonly accessToken: string; readonly response: Response }>,
  [string, RequestInit | undefined]
>();

async function mockReadResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  return text.trim() === '' ? null : JSON.parse(text);
}

jest.mock('../api/transport', () => ({
  mobileApiTransport: {
    request: async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
      const { ApiError: MockApiError } = jest.requireActual('@gzclp/api-client/api-error');
      const { authenticated: _authenticated, parse, ...init } = options;
      const requestInit = Object.keys(init).length === 0 ? undefined : init;
      const { response } = await mockFetchWithAccessToken(path, requestInit);
      const body = await mockReadResponseBody(response);
      if (!response.ok) {
        throw new MockApiError(
          `API request failed with status ${response.status}`,
          response.status,
          undefined,
          { body }
        );
      }
      try {
        return parse(body);
      } catch (cause) {
        throw new MockApiError(
          'API response did not match the expected contract',
          response.status,
          'INVALID_RESPONSE',
          { body, cause }
        );
      }
    },
  },
}));

describe('fetchProgramSummaries', () => {
  afterEach(() => {
    mockFetchWithAccessToken.mockReset();
  });

  it('follows paginated /programs responses and returns the full snapshot', async () => {
    mockFetchWithAccessToken
      .mockResolvedValueOnce(
        Promise.resolve({
          accessToken: 'mobile-access-token',
          response: new Response(
            JSON.stringify({
              data: [
                {
                  id: 'program-a',
                  name: 'Strength Base',
                  updatedAt: '2026-04-20T08:00:00.000Z',
                },
              ],
              nextCursor: 'cursor-2',
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
              },
            }
          ),
        })
      )
      .mockResolvedValueOnce(
        Promise.resolve({
          accessToken: 'mobile-access-token',
          response: new Response(
            JSON.stringify({
              data: [
                {
                  id: 'program-b',
                  name: 'Power Block',
                  updatedAt: '2026-04-18T08:00:00.000Z',
                },
              ],
              nextCursor: null,
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
              },
            }
          ),
        })
      );

    await expect(fetchProgramSummaries()).resolves.toEqual([
      {
        id: 'program-a',
        title: 'Strength Base',
        updatedAt: '2026-04-20T08:00:00.000Z',
      },
      {
        id: 'program-b',
        title: 'Power Block',
        updatedAt: '2026-04-18T08:00:00.000Z',
      },
    ]);

    expect(mockFetchWithAccessToken).toHaveBeenNthCalledWith(1, '/programs', undefined);
    expect(mockFetchWithAccessToken).toHaveBeenNthCalledWith(
      2,
      '/programs?cursor=cursor-2',
      undefined
    );
  });

  it('keeps program summary paths relative to the configured transport base', async () => {
    mockFetchWithAccessToken.mockResolvedValueOnce({
      accessToken: 'mobile-access-token',
      response: new Response(
        JSON.stringify({
          data: [],
          nextCursor: null,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      ),
    });

    await expect(fetchProgramSummaries()).resolves.toEqual([]);

    expect(mockFetchWithAccessToken).toHaveBeenCalledWith('/programs', undefined);
  });

  it('parses a program summary returned by the authorized transport', async () => {
    mockFetchWithAccessToken.mockResolvedValueOnce({
      accessToken: 'fresh-access-token',
      response: new Response(
        JSON.stringify({
          data: [
            {
              id: 'program-a',
              name: 'Strength Base',
              updatedAt: '2026-04-20T08:00:00.000Z',
            },
          ],
          nextCursor: null,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      ),
    });

    await expect(fetchProgramSummaries()).resolves.toEqual([
      {
        id: 'program-a',
        title: 'Strength Base',
        updatedAt: '2026-04-20T08:00:00.000Z',
      },
    ]);

    expect(mockFetchWithAccessToken).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed summary fields at the network boundary', async () => {
    mockFetchWithAccessToken.mockResolvedValueOnce({
      accessToken: 'mobile-access-token',
      response: new Response(
        JSON.stringify({
          data: [{ id: 'program-a', name: 42, updatedAt: { invalid: true } }],
          nextCursor: null,
        }),
        { status: 200 }
      ),
    });

    await expect(fetchProgramSummaries()).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INVALID_RESPONSE',
    });
  });

  it('stops when a paginated response repeats a cursor', async () => {
    const page = {
      accessToken: 'mobile-access-token',
      response: new Response(JSON.stringify({ data: [], nextCursor: 'same-cursor' }), {
        status: 200,
      }),
    };
    mockFetchWithAccessToken.mockResolvedValueOnce(page).mockResolvedValueOnce({
      ...page,
      response: new Response(JSON.stringify({ data: [], nextCursor: 'same-cursor' }), {
        status: 200,
      }),
    });

    await expect(fetchProgramSummaries()).rejects.toThrow(
      'Program summary pagination repeated a cursor'
    );
    expect(mockFetchWithAccessToken).toHaveBeenCalledTimes(2);
  });

  it('fetches catalog entries through the authorized API transport', async () => {
    mockFetchWithAccessToken.mockResolvedValueOnce({
      accessToken: 'mobile-access-token',
      response: new Response(
        JSON.stringify([
          {
            id: 'gzclp',
            name: 'GZCLP',
            description: 'Linear progression',
            author: 'Gravity Room',
            category: 'strength',
            level: 'beginner',
            source: 'preset',
            totalWorkouts: 36,
            workoutsPerWeek: 3,
            cycleLength: 3,
          },
        ]),
        { status: 200 }
      ),
    });

    await expect(fetchCatalogEntries()).resolves.toEqual([
      {
        id: 'gzclp',
        name: 'GZCLP',
        description: 'Linear progression',
        author: 'Gravity Room',
        category: 'strength',
        level: 'beginner',
        source: 'preset',
        totalWorkouts: 36,
        workoutsPerWeek: 3,
        cycleLength: 3,
      },
    ]);
    expect(mockFetchWithAccessToken).toHaveBeenCalledWith('/catalog', undefined);
  });

  it('fetches a catalog definition by program id', async () => {
    mockFetchWithAccessToken.mockResolvedValueOnce({
      accessToken: 'mobile-access-token',
      response: new Response(
        JSON.stringify({
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
                  stages: [{ sets: 5, reps: 3, amrap: true }],
                  onSuccess: { type: 'add_weight' },
                  onMidStageFail: { type: 'advance_stage' },
                  onFinalStageFail: { type: 'deload_percent', percent: 10 },
                  startWeightKey: 'squat',
                },
              ],
            },
          ],
          cycleLength: 1,
          totalWorkouts: 1,
          workoutsPerWeek: 3,
          exercises: { squat: { name: 'Squat' } },
          configFields: [{ key: 'squat', label: 'Squat', type: 'weight', min: 20, step: 2.5 }],
          weightIncrements: { T1: 2.5 },
        }),
        { status: 200 }
      ),
    });

    const definition = await fetchCatalogDefinition('gzclp');

    expect(definition.id).toBe('gzclp');
    expect(mockFetchWithAccessToken).toHaveBeenCalledWith('/catalog/gzclp', undefined);
  });

  it.each([
    {
      name: 'catalog collection',
      body: { data: [] },
      request: () => fetchCatalogEntries(),
    },
    {
      name: 'catalog definition',
      body: { id: 'incomplete-definition' },
      request: () => fetchCatalogDefinition('incomplete-definition'),
    },
    {
      name: 'created program detail',
      body: { id: 'incomplete-instance' },
      request: () =>
        createProgramInstance({
          programId: 'gzclp',
          name: 'GZCLP',
          config: { squat: 20 },
        }),
    },
  ])('rejects a malformed $name at the domain boundary', async ({ body, request }) => {
    mockFetchWithAccessToken.mockResolvedValueOnce({
      accessToken: 'mobile-access-token',
      response: new Response(JSON.stringify(body), { status: 200 }),
    });

    await expect(request()).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INVALID_RESPONSE',
      body,
    });
  });

  it('builds default config from weight and select fields', () => {
    expect(
      buildDefaultProgramConfig({
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
        totalWorkouts: 1,
        workoutsPerWeek: 3,
        exercises: { squat: { name: 'Squat' } },
        configFields: [
          { key: 'squat', label: 'Squat', type: 'weight', min: 0, step: 2.5 },
          {
            key: 'variant',
            label: 'Variant',
            type: 'select',
            options: [
              { label: 'Classic', value: 'classic' },
              { label: 'Compact', value: 'compact' },
            ],
          },
        ],
        weightIncrements: { T1: 2.5 },
      })
    ).toEqual({ squat: 20, variant: 'classic' });
  });

  it('creates a program instance through POST /programs', async () => {
    mockFetchWithAccessToken.mockResolvedValueOnce({
      accessToken: 'mobile-access-token',
      response: new Response(
        JSON.stringify({
          id: 'instance-1',
          programId: 'gzclp',
          name: 'GZCLP',
          config: { squat: 20 },
          metadata: null,
          results: {},
          undoHistory: [],
          resultTimestamps: {},
          completedDates: {},
          definitionId: null,
          customDefinition: null,
          status: 'active',
          createdAt: '2026-06-21T10:00:00.000Z',
          updatedAt: '2026-06-21T10:00:00.000Z',
        }),
        { status: 201 }
      ),
    });

    await expect(
      createProgramInstance({
        programId: 'gzclp',
        name: 'GZCLP',
        config: { squat: 20 },
      })
    ).resolves.toMatchObject({ id: 'instance-1', programId: 'gzclp', name: 'GZCLP' });

    expect(mockFetchWithAccessToken).toHaveBeenCalledWith('/programs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ programId: 'gzclp', name: 'GZCLP', config: { squat: 20 } }),
    });
  });
});
