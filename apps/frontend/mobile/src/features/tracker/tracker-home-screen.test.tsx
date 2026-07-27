import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { listProgramSummaries } from '../../lib/programs/program-repository';
import { readTrackerProgramId } from '../../lib/tracker/tracker-selection-storage';
import { TrackerHomeScreen } from './tracker-home-screen';
import { TrackerScreen } from './tracker-screen';

jest.mock('../../lib/programs/program-repository', () => ({
  listProgramSummaries: jest.fn(),
}));

jest.mock('../../lib/tracker/tracker-selection-storage', () => ({
  readTrackerProgramId: jest.fn(),
}));

jest.mock('./tracker-screen', () => ({ TrackerScreen: jest.fn(() => null) }));

const mockedListProgramSummaries = jest.mocked(listProgramSummaries);
const mockedReadTrackerProgramId = jest.mocked(readTrackerProgramId);
const mockedTrackerScreen = jest.mocked(TrackerScreen);

const PROGRAM_A = {
  id: 'program-a',
  programId: 'gzclp',
  title: 'A',
  status: 'active',
  createdAt: '2026-07-27T10:00:00.000Z',
  updatedAt: '2026-07-27T12:00:00.000Z',
} as const;
const PROGRAM_B = {
  ...PROGRAM_A,
  id: 'program-b',
  title: 'B',
  updatedAt: '2026-07-27T11:00:00.000Z',
} as const;

describe('TrackerHomeScreen', () => {
  afterEach(() => {
    mockedTrackerScreen.mockClear();
    mockedListProgramSummaries.mockReset();
    mockedReadTrackerProgramId.mockReset();
  });

  it('opens only the explicitly pinned owned program', async () => {
    mockedListProgramSummaries.mockResolvedValue([PROGRAM_A, PROGRAM_B]);
    mockedReadTrackerProgramId.mockResolvedValue('program-b');

    render(<TrackerHomeScreen ownerUserId="user-a" />);

    await waitFor(() => {
      expect(mockedTrackerScreen).toHaveBeenCalledWith(
        { ownerUserId: 'user-a', programInstanceId: 'program-b' },
        undefined
      );
    });
    expect(mockedListProgramSummaries).toHaveBeenCalledWith('user-a');
  });

  it('shows an empty state when no active program is pinned', async () => {
    mockedListProgramSummaries.mockResolvedValue([]);
    mockedReadTrackerProgramId.mockResolvedValue(null);

    render(<TrackerHomeScreen ownerUserId="user-a" />);

    expect(await screen.findByText('No active program')).toBeTruthy();
  });

  it('retries a failed local read', async () => {
    mockedReadTrackerProgramId.mockResolvedValue(null);
    mockedListProgramSummaries
      .mockRejectedValueOnce(new Error('read failed'))
      .mockResolvedValueOnce([]);

    render(<TrackerHomeScreen ownerUserId="user-a" />);

    fireEvent.press(await screen.findByRole('button', { name: 'Retry loading the tracker' }));

    expect(await screen.findByText('No active program')).toBeTruthy();
    expect(mockedListProgramSummaries).toHaveBeenCalledTimes(2);
  });

  it('refreshes the pin when its route adapter reports focus recovery', async () => {
    mockedListProgramSummaries.mockResolvedValue([PROGRAM_A, PROGRAM_B]);
    mockedReadTrackerProgramId
      .mockResolvedValueOnce('program-a')
      .mockResolvedValueOnce('program-b');

    const view = render(<TrackerHomeScreen ownerUserId="user-a" refreshRevision={0} />);
    await waitFor(() => {
      expect(mockedTrackerScreen).toHaveBeenLastCalledWith(
        { ownerUserId: 'user-a', programInstanceId: 'program-a' },
        undefined
      );
    });

    view.rerender(<TrackerHomeScreen ownerUserId="user-a" refreshRevision={1} />);

    await waitFor(() => {
      expect(mockedTrackerScreen).toHaveBeenLastCalledWith(
        { ownerUserId: 'user-a', programInstanceId: 'program-b' },
        undefined
      );
    });
  });
});
