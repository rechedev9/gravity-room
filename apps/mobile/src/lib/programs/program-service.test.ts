import { fetchProgramSummaries } from './program-service';

const mockGetAccessToken = jest.fn<string | null, []>();

jest.mock('../auth/session', () => ({
  getAccessToken: () => mockGetAccessToken(),
}));

describe('fetchProgramSummaries', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch> | undefined;
  const originalProcess = globalThis.process;

  afterEach(() => {
    fetchSpy?.mockRestore();
    fetchSpy = undefined;
    mockGetAccessToken.mockReset();
    globalThis.process = originalProcess;
  });

  it('follows paginated /programs responses and returns the full snapshot', async () => {
    mockGetAccessToken.mockReturnValue('mobile-access-token');

    fetchSpy = jest.spyOn(globalThis, 'fetch');
    fetchSpy
      .mockResolvedValueOnce(
        new Response(
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
        )
      )
      .mockResolvedValueOnce(
        new Response(
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
        )
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

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3001/programs',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer mobile-access-token',
        },
      })
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3001/programs?cursor=cursor-2',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer mobile-access-token',
        },
      })
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

    fetchSpy = jest.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(
      new Response(
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
      )
    );

    await expect(fetchProgramSummaries()).resolves.toEqual([]);

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/mobile-api/programs',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer mobile-access-token',
        },
      })
    );
  });
});
