import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { listProgramSummaries } from '../../lib/programs/program-repository';
import { TrackerHomeScreen } from './tracker-home-screen';
import { TrackerScreen } from './tracker-screen';

jest.mock('../../lib/programs/program-repository', () => ({
  listProgramSummaries: jest.fn(),
}));

jest.mock('./tracker-screen', () => ({ TrackerScreen: jest.fn(() => null) }));

const mockedListProgramSummaries = jest.mocked(listProgramSummaries);
const mockedTrackerScreen = jest.mocked(TrackerScreen);

describe('TrackerHomeScreen', () => {
  afterEach(() => {
    mockedTrackerScreen.mockClear();
    mockedListProgramSummaries.mockReset();
  });

  it('opens the most recently updated local program', async () => {
    mockedListProgramSummaries.mockResolvedValue([
      { id: 'recent-program', title: 'Recent', updatedAt: '2026-07-27T12:00:00.000Z' },
    ]);

    render(<TrackerHomeScreen />);

    await waitFor(() => {
      expect(mockedTrackerScreen).toHaveBeenCalledWith(
        { programInstanceId: 'recent-program' },
        undefined
      );
    });
  });

  it('shows an empty state when no program has been started', async () => {
    mockedListProgramSummaries.mockResolvedValue([]);

    render(<TrackerHomeScreen />);

    expect(await screen.findByText('No active program')).toBeTruthy();
  });

  it('retries a failed local read', async () => {
    mockedListProgramSummaries
      .mockRejectedValueOnce(new Error('read failed'))
      .mockResolvedValueOnce([]);

    render(<TrackerHomeScreen />);

    fireEvent.press(await screen.findByRole('button', { name: 'Retry loading the tracker' }));

    expect(await screen.findByText('No active program')).toBeTruthy();
    expect(mockedListProgramSummaries).toHaveBeenCalledTimes(2);
  });
});
