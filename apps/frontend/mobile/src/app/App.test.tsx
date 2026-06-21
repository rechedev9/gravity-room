import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { CatalogEntry, GenericProgramDetail, ProgramDefinition } from '@gzclp/domain';

import { App } from './App';
import { listProgramSummaries, upsertProgramSummaries } from '../lib/programs/program-repository';
import {
  buildDefaultProgramConfig,
  createProgramInstance,
  fetchCatalogDefinition,
  fetchCatalogEntries,
  fetchProgramSummaries,
} from '../lib/programs/program-service';
import { restoreSession, signInWithGoogleIdToken, signOutSession } from '../lib/auth/session';
import { clearQueuedMutations, flushQueuedMutations } from '../lib/sync/mutation-sync-service';
import { clearLocalAppData } from '../lib/db/client';
import {
  upsertProgramDefinition,
  upsertProgramDetail,
} from '../lib/tracker/program-detail-repository';

jest.mock('../lib/auth/session', () => ({
  restoreSession: jest.fn(),
  signInWithGoogleIdToken: jest.fn(),
  signOutSession: jest.fn(),
}));

const mockPromptAsync = jest.fn<Promise<string | null>, []>();

jest.mock('../features/auth/google-sign-in', () => ({
  useGoogleIdTokenPrompt: () => ({
    disabled: false,
    promptAsync: () => mockPromptAsync(),
  }),
}));

jest.mock('../lib/sync/mutation-sync-service', () => ({
  clearQueuedMutations: jest.fn(),
  flushQueuedMutations: jest.fn(),
}));

jest.mock('../lib/db/client', () => ({
  clearLocalAppData: jest.fn(),
}));

jest.mock('../lib/programs/program-repository', () => ({
  listProgramSummaries: jest.fn(),
  upsertProgramSummaries: jest.fn(),
}));

jest.mock('../lib/programs/program-service', () => ({
  buildDefaultProgramConfig: jest.fn(),
  createProgramInstance: jest.fn(),
  fetchCatalogDefinition: jest.fn(),
  fetchCatalogEntries: jest.fn(),
  fetchProgramSummaries: jest.fn(),
}));

jest.mock('../lib/tracker/program-detail-repository', () => ({
  upsertProgramDefinition: jest.fn(),
  upsertProgramDetail: jest.fn(),
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
const mockedSignOutSession = jest.mocked(signOutSession);
const mockedClearQueuedMutations = jest.mocked(clearQueuedMutations);
const mockedClearLocalAppData = jest.mocked(clearLocalAppData);
const mockedListProgramSummaries = jest.mocked(listProgramSummaries);
const mockedUpsertProgramSummaries = jest.mocked(upsertProgramSummaries);
const mockedBuildDefaultProgramConfig = jest.mocked(buildDefaultProgramConfig);
const mockedCreateProgramInstance = jest.mocked(createProgramInstance);
const mockedFetchCatalogDefinition = jest.mocked(fetchCatalogDefinition);
const mockedFetchCatalogEntries = jest.mocked(fetchCatalogEntries);
const mockedFetchProgramSummaries = jest.mocked(fetchProgramSummaries);
const mockedFlushQueuedMutations = jest.mocked(flushQueuedMutations);
const mockedUpsertProgramDefinition = jest.mocked(upsertProgramDefinition);
const mockedUpsertProgramDetail = jest.mocked(upsertProgramDetail);

const CATALOG_ENTRY = {
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
} satisfies CatalogEntry;
const PROGRAM_DEFINITION = {
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
  configFields: [{ key: 'squat', label: 'Squat', type: 'weight', min: 20, step: 2.5 }],
  weightIncrements: { T1: 2.5 },
} satisfies ProgramDefinition;
const CREATED_DETAIL = {
  id: 'created-program',
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
} satisfies GenericProgramDetail;

describe('App', () => {
  beforeEach(() => {
    mockedFlushQueuedMutations.mockResolvedValue({ processedCount: 0 });
    mockedClearQueuedMutations.mockResolvedValue();
    mockedClearLocalAppData.mockResolvedValue();
    mockedSignOutSession.mockResolvedValue();
    mockedFetchCatalogEntries.mockImplementation(() => new Promise(() => undefined));
    mockedBuildDefaultProgramConfig.mockReturnValue({ squat: 20 });
    mockedUpsertProgramDefinition.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();
    mockPromptAsync.mockResolvedValue('google-id-token');
  });

  afterEach(() => {
    mockedRestoreSession.mockReset();
    mockedSignInWithGoogleIdToken.mockReset();
    mockedSignOutSession.mockReset();
    mockedClearQueuedMutations.mockReset();
    mockedClearLocalAppData.mockReset();
    mockedListProgramSummaries.mockReset();
    mockedUpsertProgramSummaries.mockReset();
    mockedBuildDefaultProgramConfig.mockReset();
    mockedCreateProgramInstance.mockReset();
    mockedFetchCatalogDefinition.mockReset();
    mockedFetchCatalogEntries.mockReset();
    mockedFetchProgramSummaries.mockReset();
    mockedFlushQueuedMutations.mockReset();
    mockedUpsertProgramDefinition.mockReset();
    mockedUpsertProgramDetail.mockReset();
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

  it('opens the profile tab for the restored user', async () => {
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

    fireEvent.press(await screen.findByRole('button', { name: 'Open profile tab' }));

    expect(await screen.findByText('Test Athlete')).toBeTruthy();
    expect(screen.getByText('athlete@example.com')).toBeTruthy();
  });

  it('signs out from the profile tab and returns to login', async () => {
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

    fireEvent.press(await screen.findByRole('button', { name: 'Open profile tab' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Sign out of Gravity Room' }));

    await waitFor(() => {
      expect(mockedSignOutSession).toHaveBeenCalledTimes(1);
    });
    expect(mockedClearQueuedMutations).toHaveBeenCalledTimes(1);
    expect(mockedClearLocalAppData).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Continue with Google')).toBeTruthy();
  });

  it('starts a catalog program from the mobile shell and opens its tracker', async () => {
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
    mockedFetchCatalogEntries.mockResolvedValue([CATALOG_ENTRY]);
    mockedFetchCatalogDefinition.mockResolvedValue(PROGRAM_DEFINITION);
    mockedCreateProgramInstance.mockResolvedValue(CREATED_DETAIL);

    render(<App />);

    fireEvent.press(await screen.findByRole('button', { name: 'Start GZCLP' }));

    await waitFor(() => {
      expect(mockedCreateProgramInstance).toHaveBeenCalledWith({
        programId: 'gzclp',
        name: 'GZCLP',
        config: { squat: 20 },
      });
    });
    expect(mockedUpsertProgramDefinition).toHaveBeenCalledWith(PROGRAM_DEFINITION);
    expect(mockedUpsertProgramDetail).toHaveBeenCalledWith(CREATED_DETAIL);
    expect(await screen.findByText('created-program')).toBeTruthy();
  });
});
