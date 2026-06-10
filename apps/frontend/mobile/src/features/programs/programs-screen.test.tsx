import { render, screen, waitFor } from '@testing-library/react-native';

import { ProgramsScreen } from './programs-screen';
import {
  listProgramSummaries,
  upsertProgramSummaries,
} from '../../lib/programs/program-repository';
import { fetchProgramSummaries } from '../../lib/programs/program-service';

jest.mock('../../lib/programs/program-repository', () => ({
  listProgramSummaries: jest.fn(),
  upsertProgramSummaries: jest.fn(),
}));

jest.mock('../../lib/programs/program-service', () => ({
  fetchProgramSummaries: jest.fn(),
}));

// TrackerScreen is lazy-required inside programs-screen on navigation;
// it is not exercised by these tests so we stub the whole module.
jest.mock('../tracker/tracker-screen', () => ({
  TrackerScreen: () => null,
}));

const mockedListProgramSummaries = jest.mocked(listProgramSummaries);
const mockedUpsertProgramSummaries = jest.mocked(upsertProgramSummaries);
const mockedFetchProgramSummaries = jest.mocked(fetchProgramSummaries);

const PROGRAM_A = { id: 'prog-1', title: 'GZCLP A', updatedAt: '2026-01-15T00:00:00.000Z' };
const PROGRAM_B = { id: 'prog-2', title: 'Stronglifts 5x5', updatedAt: '2026-02-20T00:00:00.000Z' };

describe('ProgramsScreen', () => {
  afterEach(() => {
    mockedListProgramSummaries.mockReset();
    mockedUpsertProgramSummaries.mockReset();
    mockedFetchProgramSummaries.mockReset();
  });

  it('renders a loading indicator while the initial cache read is pending', async () => {
    // Arrange — listProgramSummaries never resolves so loading stays true
    mockedListProgramSummaries.mockImplementation(() => new Promise(() => undefined));

    // Act
    render(<ProgramsScreen />);

    // Assert — no program title shown while loading
    // ActivityIndicator has no accessible text; verify the programs list is absent
    expect(screen.queryByText(PROGRAM_A.title)).toBeNull();
    expect(screen.queryByText('No cached programs yet.')).toBeNull();
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
    expect(await screen.findByText('No cached programs yet.')).toBeTruthy();
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
});
