import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import { listProgramSummaries } from '../../lib/programs/program-repository';
import { TrackerHomeScreen } from './tracker-home-screen';
import { TrackerScreen } from './tracker-screen';

jest.mock('../../lib/programs/program-repository', () => ({
  listProgramSummaries: jest.fn(),
}));

jest.mock('./tracker-screen', () => ({ TrackerScreen: jest.fn(() => null) }));

const mockedListProgramSummaries = jest.mocked(listProgramSummaries);
const mockedTrackerScreen = jest.mocked(TrackerScreen);
const mockedSecureStore = jest.mocked(SecureStore);

describe('TrackerHomeScreen', () => {
  afterEach(() => {
    mockedTrackerScreen.mockClear();
    mockedListProgramSummaries.mockReset();
    mockedSecureStore.getItemAsync.mockReset();
  });

  it('opens the explicitly selected local program without treating programs[0] as active', async () => {
    mockedListProgramSummaries.mockResolvedValue([
      { id: 'recent-program', title: 'Recent', updatedAt: '2026-07-27T12:00:00.000Z' },
      { id: 'selected-program', title: 'Selected', updatedAt: '2026-07-26T12:00:00.000Z' },
    ]);
    mockedSecureStore.getItemAsync.mockResolvedValue('selected-program');

    render(<TrackerHomeScreen />);

    await waitFor(() => {
      expect(mockedTrackerScreen).toHaveBeenCalledWith(
        { programInstanceId: 'selected-program' },
        undefined
      );
    });
  });

  it('shows an empty state when no program has been started', async () => {
    mockedListProgramSummaries.mockResolvedValue([]);
    mockedSecureStore.getItemAsync.mockResolvedValue(null);

    render(<TrackerHomeScreen />);

    expect(await screen.findByText('No active program')).toBeTruthy();
  });

  it('retries a failed local read', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);
    mockedListProgramSummaries
      .mockRejectedValueOnce(new Error('read failed'))
      .mockResolvedValueOnce([]);

    render(<TrackerHomeScreen />);

    fireEvent.press(await screen.findByRole('button', { name: 'Retry loading the tracker' }));

    expect(await screen.findByText('No active program')).toBeTruthy();
    expect(mockedListProgramSummaries).toHaveBeenCalledTimes(2);
  });

  it('refreshes the selected program when its route adapter reports focus recovery', async () => {
    mockedListProgramSummaries.mockResolvedValue([
      { id: 'program-a', title: 'A', updatedAt: '2026-07-27T12:00:00.000Z' },
      { id: 'program-b', title: 'B', updatedAt: '2026-07-27T11:00:00.000Z' },
    ]);
    mockedSecureStore.getItemAsync
      .mockResolvedValueOnce('program-a')
      .mockResolvedValueOnce('program-b');

    const view = render(<TrackerHomeScreen refreshRevision={0} />);
    await waitFor(() => {
      expect(mockedTrackerScreen).toHaveBeenLastCalledWith(
        { programInstanceId: 'program-a' },
        undefined
      );
    });

    view.rerender(<TrackerHomeScreen refreshRevision={1} />);

    await waitFor(() => {
      expect(mockedTrackerScreen).toHaveBeenLastCalledWith(
        { programInstanceId: 'program-b' },
        undefined
      );
    });
    expect(mockedListProgramSummaries).toHaveBeenCalledTimes(2);
  });
});
