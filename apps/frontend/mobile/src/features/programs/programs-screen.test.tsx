import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { CatalogEntry, GenericProgramDetail, ProgramDefinition } from '@gzclp/domain';

import { ProgramsScreen } from './programs-screen';
import {
  listProgramSummaries,
  upsertProgramSummaries,
} from '../../lib/programs/program-repository';
import {
  buildDefaultProgramConfig,
  createProgramInstance,
  fetchCatalogDefinition,
  fetchCatalogEntries,
  fetchProgramSummaries,
} from '../../lib/programs/program-service';
import {
  upsertProgramDefinition,
  upsertProgramDetail,
} from '../../lib/tracker/program-detail-repository';

jest.mock('../../lib/programs/program-repository', () => ({
  listProgramSummaries: jest.fn(),
  upsertProgramSummaries: jest.fn(),
}));

jest.mock('../../lib/programs/program-service', () => ({
  buildDefaultProgramConfig: jest.fn(),
  createProgramInstance: jest.fn(),
  fetchCatalogDefinition: jest.fn(),
  fetchCatalogEntries: jest.fn(),
  fetchProgramSummaries: jest.fn(),
}));

jest.mock('../../lib/tracker/program-detail-repository', () => ({
  upsertProgramDefinition: jest.fn(),
  upsertProgramDetail: jest.fn(),
}));

// TrackerScreen is lazy-required inside programs-screen on navigation;
// it is not exercised by these tests so we stub the whole module.
jest.mock('../tracker/tracker-screen', () => ({
  TrackerScreen: ({ programInstanceId }: { readonly programInstanceId: string }) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, null, programInstanceId);
  },
}));

const mockedListProgramSummaries = jest.mocked(listProgramSummaries);
const mockedUpsertProgramSummaries = jest.mocked(upsertProgramSummaries);
const mockedBuildDefaultProgramConfig = jest.mocked(buildDefaultProgramConfig);
const mockedCreateProgramInstance = jest.mocked(createProgramInstance);
const mockedFetchCatalogDefinition = jest.mocked(fetchCatalogDefinition);
const mockedFetchCatalogEntries = jest.mocked(fetchCatalogEntries);
const mockedFetchProgramSummaries = jest.mocked(fetchProgramSummaries);
const mockedUpsertProgramDefinition = jest.mocked(upsertProgramDefinition);
const mockedUpsertProgramDetail = jest.mocked(upsertProgramDetail);

const PROGRAM_A = { id: 'prog-1', title: 'GZCLP A', updatedAt: '2026-01-15T00:00:00.000Z' };
const PROGRAM_B = { id: 'prog-2', title: 'Stronglifts 5x5', updatedAt: '2026-02-20T00:00:00.000Z' };
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

describe('ProgramsScreen', () => {
  beforeEach(() => {
    mockedFetchCatalogEntries.mockImplementation(() => new Promise(() => undefined));
    mockedBuildDefaultProgramConfig.mockReturnValue({ squat: 20 });
    mockedUpsertProgramDefinition.mockResolvedValue();
    mockedUpsertProgramDetail.mockResolvedValue();
  });

  afterEach(() => {
    mockedListProgramSummaries.mockReset();
    mockedUpsertProgramSummaries.mockReset();
    mockedBuildDefaultProgramConfig.mockReset();
    mockedCreateProgramInstance.mockReset();
    mockedFetchCatalogDefinition.mockReset();
    mockedFetchCatalogEntries.mockReset();
    mockedFetchProgramSummaries.mockReset();
    mockedUpsertProgramDefinition.mockReset();
    mockedUpsertProgramDetail.mockReset();
  });

  it('renders a loading indicator while the initial cache read is pending', async () => {
    // Arrange — listProgramSummaries never resolves so loading stays true
    mockedListProgramSummaries.mockImplementation(() => new Promise(() => undefined));

    // Act
    render(<ProgramsScreen />);

    // Assert — no program title shown while loading
    // ActivityIndicator has no accessible text; verify the programs list is absent
    expect(screen.queryByText(PROGRAM_A.title)).toBeNull();
    expect(screen.queryByText('No active program')).toBeNull();
    expect(screen.queryByText('Unable to load cached programs.')).toBeNull();
    // The loading container is present (stateBlock wraps the ActivityIndicator)
    expect(screen.queryByText('Retry')).toBeNull();
  });

  it('renders program list items when cache returns programs', async () => {
    // Arrange — cache has programs, remote sync also succeeds
    mockedListProgramSummaries.mockResolvedValue([PROGRAM_A, PROGRAM_B]);
    mockedFetchProgramSummaries.mockResolvedValue([PROGRAM_A, PROGRAM_B]);
    mockedUpsertProgramSummaries.mockResolvedValue();

    // Act
    render(<ProgramsScreen />);

    // Assert
    expect(await screen.findByText(PROGRAM_A.title)).toBeTruthy();
    expect(screen.getByText(PROGRAM_B.title)).toBeTruthy();
  });

  it('renders program card metadata (truncated updatedAt date)', async () => {
    // Arrange
    mockedListProgramSummaries.mockResolvedValue([PROGRAM_A]);
    mockedFetchProgramSummaries.mockImplementation(() => new Promise(() => undefined));

    // Act
    render(<ProgramsScreen />);

    // Assert — card shows "Updated YYYY-MM-DD"
    expect(await screen.findByText('Updated 2026-01-15')).toBeTruthy();
  });

  it('shows empty state when cache and remote both return no programs', async () => {
    // Arrange
    mockedListProgramSummaries.mockResolvedValue([]);
    mockedFetchProgramSummaries.mockResolvedValue([]);
    mockedUpsertProgramSummaries.mockResolvedValue();

    // Act
    render(<ProgramsScreen />);

    // Assert
    expect(await screen.findByText('No active program')).toBeTruthy();
  });

  it('renders error message when cache read throws and remote also fails', async () => {
    // Arrange — outer catch: listProgramSummaries throws
    mockedListProgramSummaries.mockRejectedValue(new Error('SQLite unavailable'));

    // Act
    render(<ProgramsScreen />);

    // Assert
    expect(await screen.findByText('Unable to load cached programs.')).toBeTruthy();
  });

  it('renders error message when cache is empty and remote fetch fails', async () => {
    // Arrange — no cached data, remote errors
    mockedListProgramSummaries.mockResolvedValue([]);
    mockedFetchProgramSummaries.mockRejectedValue(new Error('Network request failed'));

    // Act
    render(<ProgramsScreen />);

    // Assert
    expect(await screen.findByText('Unable to sync programs right now.')).toBeTruthy();
  });

  it('shows sync notice when cache has programs but remote refresh fails', async () => {
    // Arrange — cached programs exist but network is down
    mockedListProgramSummaries.mockResolvedValue([PROGRAM_A]);
    mockedFetchProgramSummaries.mockRejectedValue(new Error('Network request failed'));

    // Act
    render(<ProgramsScreen />);

    // Assert — programs still shown, sync notice displayed
    expect(await screen.findByText(PROGRAM_A.title)).toBeTruthy();
    expect(
      await screen.findByText('Showing cached programs. Sync will retry when you refresh.')
    ).toBeTruthy();
  });

  it('updates the program list after a successful remote sync', async () => {
    // Arrange — cache has stale data; remote returns newer list
    const staleProgram = {
      id: 'prog-old',
      title: 'Old Program',
      updatedAt: '2025-12-01T00:00:00.000Z',
    };
    const freshPrograms = [PROGRAM_A, PROGRAM_B];

    mockedListProgramSummaries
      .mockResolvedValueOnce([staleProgram]) // initial cache read
      .mockResolvedValueOnce(freshPrograms); // post-upsert re-read
    mockedFetchProgramSummaries.mockResolvedValue(freshPrograms);
    mockedUpsertProgramSummaries.mockResolvedValue();

    // Act
    render(<ProgramsScreen />);

    // Assert — eventually shows fresh data
    expect(await screen.findByText(PROGRAM_A.title)).toBeTruthy();
    expect(screen.getByText(PROGRAM_B.title)).toBeTruthy();

    await waitFor(() => {
      expect(mockedUpsertProgramSummaries).toHaveBeenCalledWith(freshPrograms);
    });
  });

  it('creates a catalog program and opens the tracker', async () => {
    mockedListProgramSummaries.mockResolvedValue([]);
    mockedFetchProgramSummaries.mockResolvedValue([]);
    mockedUpsertProgramSummaries.mockResolvedValue();
    mockedFetchCatalogEntries.mockResolvedValue([CATALOG_ENTRY]);
    mockedFetchCatalogDefinition.mockResolvedValue(PROGRAM_DEFINITION);
    mockedCreateProgramInstance.mockResolvedValue(CREATED_DETAIL);

    render(<ProgramsScreen />);

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
    expect(mockedUpsertProgramSummaries).toHaveBeenCalledWith([
      {
        id: 'created-program',
        title: 'GZCLP',
        updatedAt: '2026-06-21T10:00:00.000Z',
      },
    ]);
    expect(await screen.findByText('created-program')).toBeTruthy();
  });
});
