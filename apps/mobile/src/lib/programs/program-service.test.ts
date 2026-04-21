import { fetchProgramSummaries } from './program-service';

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
});
