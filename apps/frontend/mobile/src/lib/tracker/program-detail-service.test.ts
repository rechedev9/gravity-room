import type { GenericProgramDetail, ProgramDefinition } from '@gzclp/domain';
import type { ApiRequestOptions } from '@gzclp/api-client/transport';

import { fetchProgramDefinition, fetchProgramDetail } from './program-detail-service';

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
      const { authenticated, parse, ...init } = options;
      const requestInit = Object.keys(init).length === 0 ? undefined : init;
      const response =
        authenticated === false
          ? await globalThis.fetch(`http://localhost:3001/api${path}`, requestInit)
          : (await mockFetchWithAccessToken(path, requestInit)).response;
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
    mockFetchWithAccessToken.mockReset();
    globalThis.process = originalProcess;
    globalThis.fetch = originalFetch;
  });

  it('uses the /api route prefix when fetching program detail by default', async () => {
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

    expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3001/api/catalog/test-prog', undefined);
  });

  it('parses program detail returned by the authorized transport', async () => {
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

  it.each([
    {
      name: 'program detail',
      publicRequest: false,
      request: () => fetchProgramDetail('instance-1'),
    },
    {
      name: 'program definition',
      publicRequest: true,
      request: () => fetchProgramDefinition('test-prog'),
    },
  ])('rejects a malformed $name response', async ({ publicRequest, request }) => {
    const response = new Response(JSON.stringify({ id: 'incomplete' }), { status: 200 });
    if (publicRequest) {
      jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response);
    } else {
      mockFetchWithAccessToken.mockResolvedValueOnce({
        accessToken: 'mobile-access-token',
        response,
      });
    }

    await expect(request()).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INVALID_RESPONSE',
      body: { id: 'incomplete' },
    });
  });
});
