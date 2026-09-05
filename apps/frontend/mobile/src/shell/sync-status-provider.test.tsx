import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { SyncStatusProvider } from './sync-status-provider';
import { SyncStatusBanner } from '../ui/sync-status-banner';
import { readSyncStatus, type SyncStatus } from '../lib/sync/sync-status-repository';
import { queueChanges, syncRequests } from '../lib/sync/sync-events';

let mockOwner = 'owner-a';
jest.mock('./auth-provider', () => ({
  useAuth: () => ({ user: { id: mockOwner }, isOffline: false }),
}));
jest.mock('../lib/db/client', () => ({ getActiveLocalDataOwner: () => mockOwner }));
jest.mock('../lib/sync/sync-status-repository', () => ({ readSyncStatus: jest.fn() }));
const read = jest.mocked(readSyncStatus);
const renderStatus = () =>
  render(
    <SyncStatusProvider>
      <SyncStatusBanner />
    </SyncStatusProvider>
  );

beforeEach(() => {
  mockOwner = 'owner-a';
  read.mockReset().mockResolvedValue({ total: 0, needsAttention: 0 });
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});
afterEach(() => jest.restoreAllMocks());

it('shows committed changes, routes retry to the owner, and hides after acknowledgement', async () => {
  renderStatus();
  await waitFor(() => expect(read).toHaveBeenCalled());
  expect(screen.queryByText('1 change waiting to sync')).toBeNull();
  read.mockResolvedValue({ total: 2, needsAttention: 0 });
  act(() => queueChanges.publish('owner-a'));
  expect(await screen.findByText('2 changes waiting to sync')).toBeTruthy();
  const requested = jest.fn();
  const unsubscribe = syncRequests.subscribe(requested);
  try {
    fireEvent.press(screen.getByRole('button', { name: 'Retry syncing saved changes' }));
    expect(requested).toHaveBeenCalledWith('owner-a');
    read.mockResolvedValue({ total: 0, needsAttention: 0 });
    act(() => queueChanges.publish('owner-a'));
    await waitFor(() => expect(screen.queryByText('2 changes waiting to sync')).toBeNull());
  } finally {
    unsubscribe();
  }
});

it('distinguishes retained rejection from a temporary pending change', async () => {
  read.mockResolvedValue({ total: 3, needsAttention: 1 });
  renderStatus();
  expect(await screen.findByText('1 change needs attention')).toBeTruthy();
  expect(screen.getByText('Your changes stay here until they can sync.')).toBeTruthy();
  expect(screen.queryByText('3 changes waiting to sync')).toBeNull();
});

it('does not claim successful sync when local status cannot be read', async () => {
  read.mockRejectedValue(new Error('Database unavailable'));
  renderStatus();
  expect(await screen.findByText('Sync status unavailable')).toBeTruthy();
  read.mockResolvedValue({ total: 0, needsAttention: 0 });
  fireEvent.press(screen.getByRole('button', { name: 'Retry syncing saved changes' }));
  await waitFor(() => expect(screen.queryByText('Sync status unavailable')).toBeNull());
});

it('ignores stale reads and notifications from another owner', async () => {
  let resolveOlder = (_status: SyncStatus): void => undefined;
  read.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOlder = resolve;
      })
  );
  renderStatus();
  act(() => queueChanges.publish('owner-b'));
  expect(read).toHaveBeenCalledTimes(1);
  act(() => queueChanges.publish('owner-a'));
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  await act(async () => {
    resolveOlder({ total: 5, needsAttention: 5 });
  });
  expect(screen.queryByText('5 changes need attention')).toBeNull();
});
