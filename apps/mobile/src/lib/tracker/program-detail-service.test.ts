import type { GenericProgramDetail, ProgramDefinition } from '@gzclp/domain';

import { fetchProgramDefinition, fetchProgramDetail } from './program-detail-service';

const mockFetchWithAccessToken = jest.fn<
  Promise<{ readonly accessToken: string; readonly response: Response }>,
  [string, RequestInit | undefined]
>();

const mockGetAccessToken = jest.fn<string | null, []>();

jest.mock('../auth/session', () => ({
  getAccessToken: () => mockGetAccessToken(),
  buildApiUrl: (path: string) => `http://localhost:3001/api${path}`,
  fetchWithAccessToken: (path: string, init?: RequestInit) => mockFetchWithAccessToken(path, init),
}));

const TEST_DETAIL: GenericProgramDetail = {
  id: 'instance-1',
  programId: 'test-prog',
  name: 'Test Program Instance',
  config: {
    squat: 60,
    bench: 40,
  },
  metadata: null,
  results: {},
  undoHistory: [],
  resultTimestamps: {},
  completedDates: {},
  definitionId: null,
  customDefinition: null,
  status: 'active',
  createdAt: '2026-04-20T10:00:00.000Z',
  updatedAt: '2026-04-20T10:00:00.000Z',
};

const TEST_DEFINITION: ProgramDefinition = {
  id: 'test-prog',
  name: 'Test Program',
  description: 'Minimal fixture for tracker cache tests.',
  author: 'test',
  version: 1,
  category: 'strength',
  source: 'preset',
  cycleLength: 2,
  totalWorkouts: 4,
  workoutsPerWeek: 2,
  exercises: {
    squat: { name: 'Squat' },
    bench: { name: 'Bench' },
  },
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
          stages: [{ sets: 5, reps: 3, amrap: true }],
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
          stages: [{ sets: 5, reps: 3, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'bench',
        },
      ],
    },
  ],
};

describe('program detail service', () => {
  const originalProcess = globalThis.process;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    mockGetAccessToken.mockReset();
    mockFetchWithAccessToken.mockReset();
    globalThis.process = originalProcess;
    globalThis.fetch = originalFetch;
  });

  it('uses the /api route prefix when fetching program detail by default', async () => {
    mockGetAccessToken.mockReturnValue('mobile-access-token');
    mockFetchWithAccessToken.mockResolvedValueOnce({
      accessToken: 'mobile-access-token',
      response: new Response(JSON.stringify(TEST_DETAIL), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    });

    await expect(fetchProgramDetail('instance-1')).resolves.toEqual(TEST_DETAIL);

    expect(mockFetchWithAccessToken).toHaveBeenCalledWith('/programs/instance-1', undefined);
  });

  it('preserves an EXPO_PUBLIC_API_URL path prefix when fetching program definitions', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(TEST_DEFINITION), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    await expect(fetchProgramDefinition('test-prog')).resolves.toEqual(TEST_DEFINITION);

    expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3001/api/catalog/test-prog');
  });

  it('parses authorized detail fetches after a token refresh retry', async () => {
    mockGetAccessToken.mockReturnValue('expired-access-token');
    mockFetchWithAccessToken.mockResolvedValueOnce({
      accessToken: 'fresh-access-token',
      response: new Response(JSON.stringify(TEST_DETAIL), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    });

    await expect(fetchProgramDetail('instance-1')).resolves.toEqual(TEST_DETAIL);

    expect(mockFetchWithAccessToken).toHaveBeenCalledTimes(1);
  });
});
