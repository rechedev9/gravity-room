import { fetchWithAccessToken } from '../auth/session';
import {
  buildExercisesPath,
  fetchExercisePage,
  fetchMuscleGroups,
  ExerciseRequestError,
} from './exercise-service';

jest.mock('../auth/session', () => ({ fetchWithAccessToken: jest.fn() }));

const fetchMock = jest.mocked(fetchWithAccessToken);
const signal = new AbortController().signal;

function respond(body: unknown, status = 200): void {
  fetchMock.mockResolvedValueOnce({
    accessToken: 'token',
    response: new Response(JSON.stringify(body), { status }),
  });
}

describe('buildExercisesPath', () => {
  it('encodes the search text and only sends the filters that are set', () => {
    expect(
      buildExercisesPath({
        filters: { search: ' sentadilla & más ', muscleGroupId: 'legs' },
        offset: 30,
        limit: 30,
      })
    ).toBe('/exercises?limit=30&offset=30&q=sentadilla%20%26%20m%C3%A1s&muscleGroupId=legs');
    expect(
      buildExercisesPath({ filters: { search: '  ', muscleGroupId: null }, offset: 0, limit: 30 })
    ).toBe('/exercises?limit=30&offset=0');
  });
});

describe('fetchExercisePage', () => {
  it('parses rows with the domain schema and drops unreadable ones', async () => {
    respond({
      data: [{ id: 'squat', name: 'Sentadilla', muscleGroupId: 'legs' }, { name: 5 }],
      total: 811,
      offset: 0,
      limit: 30,
    });
    const page = await fetchExercisePage({
      filters: { search: '', muscleGroupId: null },
      offset: 0,
      signal,
    });
    expect(page.items.map((item) => item.id)).toEqual(['squat']);
    expect(page.received).toBe(2);
    expect(page.total).toBe(811);
  });

  it('classifies connectivity, server and payload failures', async () => {
    const input = { filters: { search: '', muscleGroupId: null }, offset: 0, signal };
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(fetchExercisePage(input)).rejects.toMatchObject({ failure: 'network' });
    respond({ error: 'boom' }, 500);
    await expect(fetchExercisePage(input)).rejects.toMatchObject({ failure: 'server' });
    respond({ nope: true });
    await expect(fetchExercisePage(input)).rejects.toBeInstanceOf(ExerciseRequestError);
  });

  it('lets cancellation through untouched', async () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    fetchMock.mockRejectedValueOnce(abort);
    await expect(
      fetchExercisePage({ filters: { search: '', muscleGroupId: null }, offset: 0, signal })
    ).rejects.toBe(abort);
  });
});

describe('fetchMuscleGroups', () => {
  it('returns the groups', async () => {
    respond([{ id: 'chest', name: 'Pecho' }]);
    await expect(fetchMuscleGroups(signal)).resolves.toEqual([{ id: 'chest', name: 'Pecho' }]);
  });
});
