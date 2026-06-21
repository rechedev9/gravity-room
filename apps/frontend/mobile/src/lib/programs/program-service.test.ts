import {
  buildDefaultProgramConfig,
  createProgramInstance,
  fetchCatalogDefinition,
  fetchCatalogEntries,
  fetchProgramSummaries,
} from './program-service';

const mockGetAccessToken = jest.fn<string | null, []>();
const mockFetchWithAccessToken = jest.fn<
  Promise<{ readonly accessToken: string; readonly response: Response }>,
  [string, RequestInit | undefined]
>();

jest.mock('../auth/session', () => ({
  getAccessToken: () => mockGetAccessToken(),
  fetchWithAccessToken: (path: string, init?: RequestInit) => mockFetchWithAccessToken(path, init),
}));

describe('fetchProgramSummaries', () => {
  const originalProcess = globalThis.process;

  afterEach(() => {
    mockGetAccessToken.mockReset();
    mockFetchWithAccessToken.mockReset();
    globalThis.process = originalProcess;
  });

  it('follows paginated /programs responses and returns the full snapshot', async () => {
    mockGetAccessToken.mockReturnValue('mobile-access-token');

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

  it('preserves an EXPO_PUBLIC_API_URL path prefix when fetching program summaries', async () => {
    mockGetAccessToken.mockReturnValue('mobile-access-token');
    globalThis.process = {
      ...originalProcess,
      env: {
        ...originalProcess.env,
        EXPO_PUBLIC_API_URL: 'https://api.example.com/mobile-api',
      },
    };

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

  it('retries program summary requests after refreshing an expired access token', async () => {
    mockGetAccessToken.mockReturnValue('expired-access-token');

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

  it('fetches catalog entries through the authorized API transport', async () => {
    mockGetAccessToken.mockReturnValue('mobile-access-token');
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
    mockGetAccessToken.mockReturnValue('mobile-access-token');
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
    mockGetAccessToken.mockReturnValue('mobile-access-token');
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
