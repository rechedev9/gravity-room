import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { App } from './App';
import { listProgramSummaries, upsertProgramSummaries } from '../lib/programs/program-repository';
import { fetchProgramSummaries } from '../lib/programs/program-service';
import { restoreSession, signInWithGoogleIdToken } from '../lib/auth/session';
import { flushQueuedMutations } from '../lib/sync/mutation-sync-service';

jest.mock('../lib/auth/session', () => ({
  restoreSession: jest.fn(),
  signInWithGoogleIdToken: jest.fn(),
}));

const mockPromptAsync = jest.fn<Promise<string | null>, []>();

jest.mock('../features/auth/google-sign-in', () => ({
  useGoogleIdTokenPrompt: () => ({
    disabled: false,
    promptAsync: () => mockPromptAsync(),
  }),
}));

jest.mock('../lib/sync/mutation-sync-service', () => ({
  flushQueuedMutations: jest.fn(),
}));

jest.mock('../lib/programs/program-repository', () => ({
  listProgramSummaries: jest.fn(),
  upsertProgramSummaries: jest.fn(),
}));

jest.mock('../lib/programs/program-service', () => ({
  fetchProgramSummaries: jest.fn(),
}));

jest.mock('../features/tracker/tracker-screen', () => ({
  TrackerScreen: ({ programInstanceId }: { programInstanceId: string }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, programInstanceId);
  },
}));

const mockedRestoreSession = jest.mocked(restoreSession);
const mockedSignInWithGoogleIdToken = jest.mocked(signInWithGoogleIdToken);
const mockedListProgramSummaries = jest.mocked(listProgramSummaries);
const mockedUpsertProgramSummaries = jest.mocked(upsertProgramSummaries);
const mockedFetchProgramSummaries = jest.mocked(fetchProgramSummaries);
const mockedFlushQueuedMutations = jest.mocked(flushQueuedMutations);

describe('App', () => {
  beforeEach(() => {
    mockedFlushQueuedMutations.mockResolvedValue({ processedCount: 0 });
    mockPromptAsync.mockResolvedValue('google-id-token');
  });

  afterEach(() => {
    mockedRestoreSession.mockReset();
    mockedSignInWithGoogleIdToken.mockReset();
    mockedListProgramSummaries.mockReset();
    mockedUpsertProgramSummaries.mockReset();
    mockedFetchProgramSummaries.mockReset();
    mockedFlushQueuedMutations.mockReset();
    mockPromptAsync.mockReset();
  });

  it('renders the Google sign-in CTA', () => {
    mockedRestoreSession.mockResolvedValue(null);

    render(<App />);

    return expect(screen.findByText('Continue with Google')).resolves.toBeTruthy();
  });

  it('signs into the mobile shell after tapping Continue with Google', async () => {
    mockedRestoreSession.mockResolvedValue(null);
    mockedSignInWithGoogleIdToken.mockResolvedValue({
      accessToken: 'fresh-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });
    mockedFetchProgramSummaries.mockResolvedValue([]);
    mockedUpsertProgramSummaries.mockResolvedValue();
    mockedListProgramSummaries.mockResolvedValue([]);
    mockedFlushQueuedMutations.mockResolvedValue({ processedCount: 0 });

    render(<App />);

    fireEvent.press(await screen.findByRole('button', { name: 'Continue with Google' }));

    await waitFor(() => {
      expect(mockedSignInWithGoogleIdToken).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('Cached training blocks')).toBeTruthy();
  });

  it('renders cached programs when a session is available', async () => {
    mockedRestoreSession.mockResolvedValue({
      accessToken: 'restored-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });
    mockedFetchProgramSummaries.mockResolvedValue([]);
    mockedUpsertProgramSummaries.mockResolvedValue();
    mockedListProgramSummaries.mockResolvedValue([]);

    render(<App />);

    expect(await screen.findByText('Cached training blocks')).toBeTruthy();
    expect(await screen.findByText('No cached programs yet.')).toBeTruthy();
    expect(screen.queryByText('Continue with Google')).toBeNull();
  });

  it('hydrates the local cache from remote program summaries before rendering', async () => {
    mockedRestoreSession.mockResolvedValue({
      accessToken: 'restored-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });
    mockedFetchProgramSummaries.mockResolvedValue([
      {
        id: 'program-123',
        title: 'Power Block',
        updatedAt: '2026-04-20T08:00:00.000Z',
      },
    ]);
    mockedUpsertProgramSummaries.mockResolvedValue();
    mockedListProgramSummaries.mockResolvedValue([
      {
        id: 'program-123',
        title: 'Power Block',
        updatedAt: '2026-04-20T08:00:00.000Z',
      },
    ]);

    render(<App />);

    expect(await screen.findByText('Power Block')).toBeTruthy();
    expect(mockedFetchProgramSummaries).toHaveBeenCalledTimes(1);
    expect(mockedUpsertProgramSummaries).toHaveBeenCalledWith([
      {
        id: 'program-123',
        title: 'Power Block',
        updatedAt: '2026-04-20T08:00:00.000Z',
      },
    ]);
  });

  it('renders cached programs before the remote refresh completes', async () => {
    mockedRestoreSession.mockResolvedValue({
      accessToken: 'restored-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });

    let releaseRemoteFetch: (() => void) | undefined;
    mockedFetchProgramSummaries.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseRemoteFetch = () => {
            resolve([
              {
                id: 'program-remote',
                title: 'Remote Block',
                updatedAt: '2026-04-21T08:00:00.000Z',
              },
            ]);
          };
        })
    );
    mockedUpsertProgramSummaries.mockResolvedValue();
    mockedListProgramSummaries
      .mockResolvedValueOnce([
        {
          id: 'program-cached',
          title: 'Cached Block',
          updatedAt: '2026-04-20T08:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'program-remote',
          title: 'Remote Block',
          updatedAt: '2026-04-21T08:00:00.000Z',
        },
      ]);

    render(<App />);

    expect(await screen.findByText('Cached Block')).toBeTruthy();
    expect(screen.queryByText('Remote Block')).toBeNull();
    expect(mockedListProgramSummaries).toHaveBeenCalledTimes(1);

    releaseRemoteFetch?.();

    expect(await screen.findByText('Remote Block')).toBeTruthy();
    expect(mockedUpsertProgramSummaries).toHaveBeenCalledWith([
      {
        id: 'program-remote',
        title: 'Remote Block',
        updatedAt: '2026-04-21T08:00:00.000Z',
      },
    ]);
    expect(mockedListProgramSummaries).toHaveBeenCalledTimes(2);
  });

  it('keeps cached programs visible when the remote refresh fails', async () => {
    mockedRestoreSession.mockResolvedValue({
      accessToken: 'restored-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });
    mockedListProgramSummaries.mockResolvedValue([
      {
        id: 'program-cached',
        title: 'Cached Block',
        updatedAt: '2026-04-20T08:00:00.000Z',
      },
    ]);
    mockedFetchProgramSummaries.mockRejectedValue(new Error('Network request failed'));

    render(<App />);

    expect(await screen.findByText('Cached Block')).toBeTruthy();
    expect(
      await screen.findByText('Showing cached programs. Sync will retry when you refresh.')
    ).toBeTruthy();
    expect(screen.getByText('Retry')).toBeTruthy();
    expect(screen.queryByText('No cached programs yet.')).toBeNull();
    expect(screen.queryByText('Unable to load cached programs.')).toBeNull();
  });

  it('retries cached program sync from the sync notice state', async () => {
    mockedRestoreSession.mockResolvedValue({
      accessToken: 'restored-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });
    mockedFetchProgramSummaries
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce([
        {
          id: 'program-remote',
          title: 'Remote Block',
          updatedAt: '2026-04-21T08:00:00.000Z',
        },
      ]);
    mockedUpsertProgramSummaries.mockResolvedValue();
    mockedListProgramSummaries
      .mockResolvedValueOnce([
        {
          id: 'program-cached',
          title: 'Cached Block',
          updatedAt: '2026-04-20T08:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'program-cached',
          title: 'Cached Block',
          updatedAt: '2026-04-20T08:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'program-remote',
          title: 'Remote Block',
          updatedAt: '2026-04-21T08:00:00.000Z',
        },
      ]);

    render(<App />);

    expect(await screen.findByText('Cached Block')).toBeTruthy();
    expect(await screen.findByText('Retry')).toBeTruthy();

    fireEvent.press(screen.getByText('Retry'));

    expect(await screen.findByText('Remote Block')).toBeTruthy();
    expect(mockedFetchProgramSummaries).toHaveBeenCalledTimes(2);
  });

  it('shows a sync error instead of the empty cache state when refresh fails before any cache exists', async () => {
    mockedRestoreSession.mockResolvedValue({
      accessToken: 'restored-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });
    mockedFetchProgramSummaries.mockRejectedValue(new Error('Network request failed'));
    mockedListProgramSummaries.mockResolvedValue([]);

    render(<App />);

    expect(await screen.findByText('Unable to sync programs right now.')).toBeTruthy();
    expect(screen.getByText('Retry')).toBeTruthy();
    expect(screen.queryByText('No cached programs yet.')).toBeNull();
  });

  it('renders a load error instead of the empty cache state when program loading fails', async () => {
    mockedRestoreSession.mockResolvedValue({
      accessToken: 'restored-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });
    mockedFetchProgramSummaries.mockRejectedValue(new Error('Network request failed'));
    mockedListProgramSummaries.mockRejectedValue(new Error('SQLite unavailable'));

    render(<App />);

    expect(await screen.findByText('Unable to load cached programs.')).toBeTruthy();
    expect(screen.getByText('Retry')).toBeTruthy();
    expect(screen.queryByText('No cached programs yet.')).toBeNull();
  });

  it('falls back to the signed-out shell when session restore rejects', async () => {
    mockedRestoreSession.mockRejectedValue(new Error('Network request failed'));

    render(<App />);

    expect(await screen.findByText('Continue with Google')).toBeTruthy();
  });

  it('opens the tracker shell after tapping a cached program card', async () => {
    mockedRestoreSession.mockResolvedValue({
      accessToken: 'restored-access-token',
      user: {
        id: 'user-123',
        email: 'athlete@example.com',
        name: 'Test Athlete',
        avatarUrl: null,
      },
    });
    mockedFetchProgramSummaries.mockResolvedValue([]);
    mockedUpsertProgramSummaries.mockResolvedValue();
    mockedListProgramSummaries.mockResolvedValue([
      {
        id: 'program-123',
        title: 'Power Block',
        updatedAt: '2026-04-20T08:00:00.000Z',
      },
    ]);
    mockedFlushQueuedMutations.mockResolvedValue({ processedCount: 0 });

    render(<App />);

    fireEvent.press(await screen.findByText('Power Block'));

    expect(await screen.findByText('program-123')).toBeTruthy();
  });
});
