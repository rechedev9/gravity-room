import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { CatalogEntry } from '@gzclp/domain';

import {
  commitProgramCatalogRefresh,
  commitProgramSummariesRefresh,
  listProgramSummaries,
  readPendingDeleteReconciliations,
  readPendingManageReconciliations,
  readProgramCatalogSnapshot,
  readProgramLibrarySnapshot,
} from '../../lib/programs/program-repository';
import {
  deleteProgram,
  manageProgram,
  reconcilePendingProgramManagement,
  verifyPendingProgramDelete,
} from '../../lib/programs/program-use-cases';
import { fetchCatalogEntries, fetchProgramSummaries } from '../../lib/programs/program-service';
import {
  abandonProgramRefreshLease,
  isProgramRefreshLeaseCurrent,
  withProgramRefreshCommitBarrier,
} from '../../lib/programs/program-refresh-generation';
import {
  readTrackerProgramId,
  writeTrackerProgramId,
} from '../../lib/tracker/tracker-selection-storage';
import { ProgramsScreen } from './programs-screen';

jest.mock('../../lib/programs/program-repository', () => ({
  commitProgramCatalogRefresh: jest.fn(),
  commitProgramSummariesRefresh: jest.fn(),
  listProgramSummaries: jest.fn(),
  readPendingDeleteReconciliations: jest.fn(),
  readPendingManageReconciliations: jest.fn(),
  readProgramCatalogSnapshot: jest.fn(),
  readProgramLibrarySnapshot: jest.fn(),
}));

jest.mock('../../lib/auth/session', () => ({
  captureAuthorizedSession: jest.fn((ownerUserId: string) => ({
    ownerUserId,
    accessToken: 'token-a',
    generation: 1,
  })),
  isAuthorizedSessionCurrent: jest.fn(() => true),
}));

jest.mock('../../lib/programs/program-refresh-generation', () => ({
  abandonProgramRefreshLease: jest.fn(),
  captureProgramRefreshLease: jest.fn(
    (ownerUserId: string, resource: string, session: unknown) => ({
      ownerUserId,
      resource,
      generation: 0,
      session,
    })
  ),
  isProgramRefreshLeaseCurrent: jest.fn(() => true),
  withProgramRefreshCommitBarrier: jest.fn(
    (_ownerUserId: string, _resource: string, task: () => Promise<unknown>) => task()
  ),
}));

jest.mock('../../lib/programs/program-use-cases', () => ({
  deleteProgram: jest.fn(),
  manageProgram: jest.fn(),
  reconcilePendingProgramManagement: jest.fn(),
  verifyPendingProgramDelete: jest.fn(),
}));

jest.mock('../../lib/programs/program-service', () => ({
  fetchCatalogEntries: jest.fn(),
  fetchProgramSummaries: jest.fn(),
}));

jest.mock('../../lib/tracker/tracker-selection-storage', () => ({
  readTrackerProgramId: jest.fn(),
  writeTrackerProgramId: jest.fn(),
}));

const mockedListProgramSummaries = jest.mocked(listProgramSummaries);
const mockedReadProgramCatalogSnapshot = jest.mocked(readProgramCatalogSnapshot);
const mockedReadProgramLibrarySnapshot = jest.mocked(readProgramLibrarySnapshot);
const mockedCommitProgramCatalogRefresh = jest.mocked(commitProgramCatalogRefresh);
const mockedCommitProgramSummariesRefresh = jest.mocked(commitProgramSummariesRefresh);
const mockedIsProgramRefreshLeaseCurrent = jest.mocked(isProgramRefreshLeaseCurrent);
const mockedAbandonProgramRefreshLease = jest.mocked(abandonProgramRefreshLease);
const mockedWithProgramRefreshCommitBarrier = jest.mocked(withProgramRefreshCommitBarrier);
const mockedReadPendingDeleteReconciliations = jest.mocked(readPendingDeleteReconciliations);
const mockedReadPendingManageReconciliations = jest.mocked(readPendingManageReconciliations);
const mockedDeleteProgram = jest.mocked(deleteProgram);
const mockedManageProgram = jest.mocked(manageProgram);
const mockedReconcilePendingProgramManagement = jest.mocked(reconcilePendingProgramManagement);
const mockedVerifyPendingProgramDelete = jest.mocked(verifyPendingProgramDelete);
const mockedFetchCatalogEntries = jest.mocked(fetchCatalogEntries);
const mockedFetchProgramSummaries = jest.mocked(fetchProgramSummaries);
const mockedReadTrackerProgramId = jest.mocked(readTrackerProgramId);
const mockedWriteTrackerProgramId = jest.mocked(writeTrackerProgramId);
const mockOpenPreset = jest.fn<void, [string]>();
const mockOpenProgram = jest.fn<void, [string]>();

const ACTIVE = {
  id: 'program-active',
  programId: 'gzclp',
  title: 'Active program',
  status: 'active',
  createdAt: '2026-07-27T08:00:00.000Z',
  updatedAt: '2026-07-27T12:00:00.000Z',
} as const;
const COMPLETED = {
  ...ACTIVE,
  id: 'program-completed',
  title: 'Completed program',
  status: 'completed',
} as const;
const ARCHIVED = {
  ...ACTIVE,
  id: 'program-archived',
  title: 'Archived program',
  status: 'archived',
} as const;
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

function renderPrograms(ownerUserId = 'user-a') {
  return render(
    <ProgramsScreen
      onOpenPreset={mockOpenPreset}
      onOpenProgram={mockOpenProgram}
      ownerUserId={ownerUserId}
    />
  );
}

describe('ProgramsScreen M2 library', () => {
  beforeEach(() => {
    mockedListProgramSummaries.mockResolvedValue([ACTIVE, COMPLETED, ARCHIVED]);
    mockedFetchProgramSummaries.mockResolvedValue([ACTIVE, COMPLETED, ARCHIVED]);
    mockedCommitProgramSummariesRefresh.mockResolvedValue(true);
    mockedIsProgramRefreshLeaseCurrent.mockReturnValue(true);
    mockedWithProgramRefreshCommitBarrier.mockImplementation(
      async (_ownerUserId, _resource, task) => task()
    );
    mockedReadPendingDeleteReconciliations.mockResolvedValue([]);
    mockedReadPendingManageReconciliations.mockResolvedValue([]);
    mockedReadProgramLibrarySnapshot.mockResolvedValue({
      status: 'snapshot',
      data: [ACTIVE, COMPLETED, ARCHIVED],
      syncedAt: '2026-07-27T12:00:00.000Z',
    });
    mockedReadProgramCatalogSnapshot.mockResolvedValue({
      status: 'snapshot',
      data: [CATALOG_ENTRY],
      syncedAt: '2026-07-27T12:00:00.000Z',
    });
    mockedFetchCatalogEntries.mockResolvedValue([CATALOG_ENTRY]);
    mockedCommitProgramCatalogRefresh.mockResolvedValue(true);
    mockedReadTrackerProgramId.mockResolvedValue(ACTIVE.id);
    mockedWriteTrackerProgramId.mockResolvedValue();
    mockedManageProgram.mockResolvedValue({
      status: 'applied',
      remote: {
        id: ACTIVE.id,
        programId: ACTIVE.programId,
        name: ACTIVE.title,
        config: {},
        metadata: null,
        results: {},
        undoHistory: [],
        resultTimestamps: {},
        completedDates: {},
        definitionId: null,
        customDefinition: null,
        status: 'active',
        createdAt: ACTIVE.createdAt,
        updatedAt: ACTIVE.updatedAt,
      },
    });
    mockedReconcilePendingProgramManagement.mockResolvedValue();
    mockedVerifyPendingProgramDelete.mockResolvedValue('still_pending');
    mockedDeleteProgram.mockResolvedValue({ status: 'applied', remote: 'deleted' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('renders pinned, active, completed and archived lists from one coherent snapshot', async () => {
    renderPrograms();

    expect(await screen.findByText('Pinned program')).toBeTruthy();
    expect(screen.getAllByText('Active program').length).toBeGreaterThan(0);
    expect(screen.getByText('Completed program')).toBeTruthy();
    expect(screen.getByText('Archived program')).toBeTruthy();
    expect(screen.getByText('Active (1)')).toBeTruthy();
    expect(screen.getByText('Completed (1)')).toBeTruthy();
    expect(screen.getByText('Archived (1)')).toBeTruthy();
  });

  it('does not publish a committed response after its producer becomes obsolete', async () => {
    mockedFetchProgramSummaries.mockResolvedValue([
      { ...ACTIVE, title: 'Obsolete committed response' },
    ]);
    mockedIsProgramRefreshLeaseCurrent.mockReturnValue(false);

    renderPrograms();

    expect(await screen.findAllByText(ACTIVE.title)).toHaveLength(2);
    await waitFor(() => {
      expect(mockedCommitProgramSummariesRefresh).toHaveBeenCalled();
    });
    expect(screen.queryByText('Obsolete committed response')).toBeNull();
  });

  it('abandons captured refresh leases when the screen unmounts during network work', async () => {
    mockedFetchProgramSummaries.mockImplementation(() => new Promise(() => undefined));
    mockedFetchCatalogEntries.mockImplementation(() => new Promise(() => undefined));
    const view = renderPrograms();

    view.unmount();

    await waitFor(() => {
      expect(mockedAbandonProgramRefreshLease).toHaveBeenCalledWith(
        expect.objectContaining({ ownerUserId: 'user-a', resource: 'library' })
      );
      expect(mockedAbandonProgramRefreshLease).toHaveBeenCalledWith(
        expect.objectContaining({ ownerUserId: 'user-a', resource: 'catalog' })
      );
    });
  });

  it('publishes reconciled local truth after reconciliation invalidates the network lease', async () => {
    const reconciled = { ...ACTIVE, title: 'Reconciled local program' };
    mockedReconcilePendingProgramManagement.mockImplementation(async () => {
      mockedListProgramSummaries.mockResolvedValue([reconciled, COMPLETED, ARCHIVED]);
      mockedIsProgramRefreshLeaseCurrent.mockImplementation(
        (lease) => lease.resource !== 'library'
      );
    });

    renderPrograms();

    expect(await screen.findAllByText(reconciled.title)).toHaveLength(2);
    expect(screen.queryByText(ACTIVE.title)).toBeNull();
  });

  it('waits for a concurrent library mutation before reading the reconciled snapshot', async () => {
    let releaseMutation!: () => void;
    const mutationCompleted = new Promise<void>((resolve) => {
      releaseMutation = resolve;
    });
    const renamed = { ...ACTIVE, title: 'Mutation-winning program' };
    mockedWithProgramRefreshCommitBarrier.mockImplementation(
      async (_ownerUserId, resource, task) => {
        if (resource === 'library') {
          await mutationCompleted;
        }
        return task();
      }
    );

    renderPrograms();

    await waitFor(() => {
      expect(mockedWithProgramRefreshCommitBarrier).toHaveBeenCalledWith(
        'user-a',
        'library',
        expect.any(Function)
      );
    });
    mockedListProgramSummaries.mockResolvedValue([renamed, COMPLETED, ARCHIVED]);
    releaseMutation();

    expect(await screen.findAllByText(renamed.title)).toHaveLength(2);
    expect(screen.queryByText(ACTIVE.title)).toBeNull();
  });

  it('shows cached library and catalog with explicit offline reading states', async () => {
    mockedFetchProgramSummaries.mockRejectedValue(new Error('offline'));
    mockedFetchCatalogEntries.mockRejectedValue(new Error('offline'));

    renderPrograms();

    expect(
      await screen.findByText('Offline: showing your last synchronized program library.')
    ).toBeTruthy();
    expect(
      screen.getByText('Offline: showing the preset catalog saved on this device.')
    ).toBeTruthy();
    expect(screen.getByText('GZCLP')).toBeTruthy();
  });

  it('settles a failed obsolete refresh from mutation-winning SQLite truth', async () => {
    const mutationWinner = { ...ACTIVE, title: 'Offline mutation winner' };
    mockedReadProgramLibrarySnapshot
      .mockResolvedValueOnce({
        status: 'snapshot',
        data: [ACTIVE],
        syncedAt: '2026-07-27T12:00:00.000Z',
      })
      .mockResolvedValueOnce({
        status: 'snapshot',
        data: [mutationWinner],
        syncedAt: '2026-07-27T12:01:00.000Z',
      });
    mockedFetchProgramSummaries.mockRejectedValue(new Error('offline after mutation'));
    mockedIsProgramRefreshLeaseCurrent.mockReturnValue(false);

    renderPrograms();

    expect(await screen.findAllByText(mutationWinner.title)).toHaveLength(2);
    expect(screen.queryByText(ACTIVE.title)).toBeNull();
  });

  it('settles a failed obsolete catalog request from winning SQLite truth', async () => {
    const winningCatalogEntry = {
      ...CATALOG_ENTRY,
      id: 'offline-mutation-winning-preset',
      name: 'Offline mutation-winning preset',
      source: 'external',
    } as const;
    mockedReadProgramCatalogSnapshot
      .mockResolvedValueOnce({
        status: 'snapshot',
        data: [CATALOG_ENTRY],
        syncedAt: '2026-07-27T12:00:00.000Z',
      })
      .mockResolvedValueOnce({
        status: 'snapshot',
        data: [winningCatalogEntry],
        syncedAt: '2026-07-27T12:01:00.000Z',
      });
    mockedFetchCatalogEntries.mockRejectedValue(new Error('offline after mutation'));
    mockedIsProgramRefreshLeaseCurrent.mockReturnValue(false);

    renderPrograms();

    expect(await screen.findByText(winningCatalogEntry.name)).toBeTruthy();
    expect(screen.queryByText(CATALOG_ENTRY.name)).toBeNull();
  });

  it('treats an empty readable cache as a valid offline snapshot', async () => {
    mockedListProgramSummaries.mockResolvedValue([]);
    mockedReadProgramLibrarySnapshot.mockResolvedValue({
      status: 'snapshot_empty',
      data: [],
      syncedAt: '2026-07-27T12:00:00.000Z',
    });
    mockedReadProgramCatalogSnapshot.mockResolvedValue({
      status: 'snapshot_empty',
      data: [],
      syncedAt: '2026-07-27T12:00:00.000Z',
    });
    mockedReadTrackerProgramId.mockResolvedValue(null);
    mockedFetchProgramSummaries.mockRejectedValue(new Error('offline'));
    mockedFetchCatalogEntries.mockRejectedValue(new Error('offline'));

    renderPrograms();

    expect(
      await screen.findByText('Offline: showing your last synchronized program library.')
    ).toBeTruthy();
    expect(
      screen.getByText('Offline: showing the preset catalog saved on this device.')
    ).toBeTruthy();
    expect(screen.getByText('Active (0)')).toBeTruthy();
    expect(screen.queryByText('Unable to sync programs right now.')).toBeNull();
  });

  it('reports first-sync unavailability when offline storage has no snapshot marker', async () => {
    mockedReadProgramLibrarySnapshot.mockResolvedValue({ status: 'no_snapshot', data: [] });
    mockedReadProgramCatalogSnapshot.mockResolvedValue({ status: 'no_snapshot', data: [] });
    mockedReadTrackerProgramId.mockResolvedValue(null);
    mockedFetchProgramSummaries.mockRejectedValue(new Error('offline'));
    mockedFetchCatalogEntries.mockRejectedValue(new Error('offline'));

    renderPrograms();

    expect(
      await screen.findByText(
        'Your library has not been synchronized on this device yet. Connect to complete the first sync.'
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        'The catalog has not been synchronized on this device yet. Connect to complete the first sync.'
      )
    ).toBeTruthy();
    expect(
      screen.queryByText('Offline: showing your last synchronized program library.')
    ).toBeNull();
  });

  it('shows acknowledged partial programs without calling them a synchronized snapshot', async () => {
    mockedReadProgramLibrarySnapshot.mockResolvedValue({
      status: 'no_snapshot',
      data: [ACTIVE],
    });
    mockedFetchProgramSummaries.mockRejectedValue(new Error('offline'));

    renderPrograms();

    expect(
      await screen.findByText(
        'Showing confirmed programs on this device. The full library remains unavailable until the first sync completes.'
      )
    ).toBeTruthy();
    expect(screen.getAllByText(ACTIVE.title).length).toBeGreaterThan(0);
    expect(
      screen.queryByText('Offline: showing your last synchronized program library.')
    ).toBeNull();
  });

  it('renders an accessible EmptyState for a fresh empty catalog', async () => {
    mockedReadProgramCatalogSnapshot.mockResolvedValue({ status: 'no_snapshot', data: [] });
    mockedFetchCatalogEntries.mockResolvedValue([]);

    renderPrograms();

    const title = await screen.findByText('No presets available');
    expect(title).toBeTruthy();
    expect(screen.UNSAFE_getByProps({ accessibilityRole: 'summary' })).toBeTruthy();
  });

  it('marks cached data as revalidating while a slow fetch is still pending', async () => {
    mockedFetchProgramSummaries.mockImplementation(() => new Promise(() => undefined));
    mockedFetchCatalogEntries.mockImplementation(() => new Promise(() => undefined));

    renderPrograms();

    expect(
      await screen.findByText('Showing cached programs while checking the server for updates.')
    ).toBeTruthy();
    expect(screen.getByText('Showing the saved catalog while checking for updates.')).toBeTruthy();
    expect(
      screen.queryByText('Offline: showing your last synchronized program library.')
    ).toBeNull();
  });

  it('settles a rejected library commit from the winning SQLite snapshot', async () => {
    const winningProgram = { ...ACTIVE, title: 'Winning local program' };
    mockedReadPendingManageReconciliations.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        programInstanceId: winningProgram.id,
        expectation: { type: 'rename', name: 'Winning pending name' },
      },
    ]);
    mockedReadProgramLibrarySnapshot
      .mockResolvedValueOnce({
        status: 'snapshot',
        data: [ACTIVE],
        syncedAt: '2026-07-27T12:00:00.000Z',
      })
      .mockResolvedValueOnce({
        status: 'snapshot',
        data: [winningProgram, COMPLETED],
        syncedAt: '2026-07-27T12:01:00.000Z',
      });
    mockedReadTrackerProgramId.mockResolvedValueOnce(ACTIVE.id).mockResolvedValueOnce(COMPLETED.id);
    mockedCommitProgramSummariesRefresh.mockResolvedValue(false);

    renderPrograms();

    await waitFor(() => {
      expect(screen.getAllByText(winningProgram.title).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(COMPLETED.title)).toHaveLength(2);
    expect(
      screen.getByText('Pending saved change: rename this program to “Winning pending name”.')
    ).toBeTruthy();
    expect(mockedReadTrackerProgramId).toHaveBeenCalledTimes(2);
    expect(screen.queryByLabelText('Loading your program library')).toBeNull();
  });

  it('settles a rejected catalog commit from the winning SQLite snapshot', async () => {
    const winningCatalogEntry = {
      ...CATALOG_ENTRY,
      id: 'winning-preset',
      name: 'Winning preset',
      source: 'external',
    } as const;
    mockedReadProgramCatalogSnapshot
      .mockResolvedValueOnce({
        status: 'snapshot',
        data: [CATALOG_ENTRY],
        syncedAt: '2026-07-27T12:00:00.000Z',
      })
      .mockResolvedValueOnce({
        status: 'no_snapshot',
        data: [winningCatalogEntry],
      });
    mockedCommitProgramCatalogRefresh.mockResolvedValue(false);

    renderPrograms();

    expect(await screen.findByText(winningCatalogEntry.name)).toBeTruthy();
    expect(screen.queryByLabelText('Loading the preset catalog')).toBeNull();
  });

  it('settles a successful catalog commit from a queued mutation winner', async () => {
    const winningCatalogEntry = {
      ...CATALOG_ENTRY,
      id: 'mutation-winning-preset',
      name: 'Mutation-winning preset',
      source: 'external',
    } as const;
    mockedReadProgramCatalogSnapshot
      .mockResolvedValueOnce({
        status: 'snapshot',
        data: [CATALOG_ENTRY],
        syncedAt: '2026-07-27T12:00:00.000Z',
      })
      .mockResolvedValueOnce({
        status: 'snapshot',
        data: [winningCatalogEntry],
        syncedAt: '2026-07-27T12:01:00.000Z',
      });
    mockedIsProgramRefreshLeaseCurrent.mockReturnValue(false);

    renderPrograms();

    expect(await screen.findByText(winningCatalogEntry.name)).toBeTruthy();
    expect(screen.queryByLabelText('Loading the preset catalog')).toBeNull();
  });

  it('keeps a valid library snapshot when recovery metadata cannot be read', async () => {
    mockedReadPendingManageReconciliations.mockRejectedValue(
      new Error('corrupt recovery metadata')
    );
    mockedFetchProgramSummaries.mockRejectedValue(new Error('offline'));

    renderPrograms();

    expect(await screen.findAllByText(ACTIVE.title)).not.toHaveLength(0);
    expect(
      await screen.findByText('Offline: showing your last synchronized program library.')
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Saved change recovery could not be verified. Program actions are disabled until you retry.'
      )
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Complete' })).toBeNull();
    expect(screen.queryByText('Your program library could not be loaded.')).toBeNull();
  });

  it('hides the previous owner library synchronously on an account switch', async () => {
    const privateProgram = { ...ACTIVE, title: 'Owner A private program' };
    mockedReadProgramLibrarySnapshot.mockResolvedValue({
      status: 'snapshot',
      data: [privateProgram],
      syncedAt: '2026-07-27T12:00:00.000Z',
    });
    mockedFetchProgramSummaries.mockImplementation(() => new Promise(() => undefined));
    mockedFetchCatalogEntries.mockImplementation(() => new Promise(() => undefined));
    const view = renderPrograms();

    expect((await screen.findAllByText(privateProgram.title)).length).toBeGreaterThan(0);
    expect(
      await screen.findByText('Showing the saved catalog while checking for updates.')
    ).toBeTruthy();

    mockedReadProgramLibrarySnapshot.mockImplementation(() => new Promise(() => undefined));
    mockedReadProgramCatalogSnapshot.mockImplementation(() => new Promise(() => undefined));
    mockedReadTrackerProgramId.mockImplementation(() => new Promise(() => undefined));
    view.rerender(
      <ProgramsScreen
        onOpenPreset={mockOpenPreset}
        onOpenProgram={mockOpenProgram}
        ownerUserId="user-b"
      />
    );

    expect(screen.queryByText(privateProgram.title)).toBeNull();
    expect(screen.getByLabelText('Loading your program library')).toBeTruthy();
  });

  it('does not let a failed owner-A recovery clobber owner B after an account switch', async () => {
    const ownerAProgram = { ...ACTIVE, title: 'Owner A program' };
    const ownerBProgram = {
      ...ACTIVE,
      id: 'owner-b-program',
      title: 'Owner B program',
    };
    let rejectOwnerARecovery = (): void => undefined;
    let markOwnerARecoveryStarted = (): void => undefined;
    const ownerARecoveryStarted = new Promise<void>((resolve) => {
      markOwnerARecoveryStarted = resolve;
    });
    let ownerAReadCount = 0;
    mockedReadProgramLibrarySnapshot.mockImplementation((ownerUserId) => {
      if (ownerUserId === 'user-b') {
        return Promise.resolve({
          status: 'snapshot',
          data: [ownerBProgram],
          syncedAt: '2026-07-27T12:01:00.000Z',
        });
      }
      ownerAReadCount += 1;
      if (ownerAReadCount === 1) {
        return Promise.resolve({
          status: 'snapshot',
          data: [ownerAProgram],
          syncedAt: '2026-07-27T12:00:00.000Z',
        });
      }
      return new Promise((_, reject) => {
        markOwnerARecoveryStarted();
        rejectOwnerARecovery = () => reject(new Error('owner A cache failed late'));
      });
    });
    mockedFetchProgramSummaries
      .mockRejectedValueOnce(new Error('owner A offline'))
      .mockResolvedValueOnce([ownerBProgram]);
    mockedListProgramSummaries.mockImplementation((ownerUserId) =>
      Promise.resolve(ownerUserId === 'user-b' ? [ownerBProgram] : [ownerAProgram])
    );

    const view = renderPrograms();
    await act(async () => {
      await ownerARecoveryStarted;
    });
    await act(async () => {
      view.rerender(
        <ProgramsScreen
          onOpenPreset={mockOpenPreset}
          onOpenProgram={mockOpenProgram}
          ownerUserId="user-b"
        />
      );
    });

    expect(await screen.findByText(ownerBProgram.title)).toBeTruthy();
    await act(async () => {
      rejectOwnerARecovery();
    });
    expect(screen.getByText(ownerBProgram.title)).toBeTruthy();
    expect(screen.queryByLabelText('Loading your program library')).toBeNull();
    expect(screen.queryByText('Your program library could not be loaded.')).toBeNull();
  });

  it('labels loading indicators and exposes load failures as alerts', async () => {
    mockedReadProgramLibrarySnapshot.mockImplementation(() => new Promise(() => undefined));
    mockedReadProgramCatalogSnapshot.mockImplementation(() => new Promise(() => undefined));
    mockedFetchProgramSummaries.mockImplementation(() => new Promise(() => undefined));
    mockedFetchCatalogEntries.mockImplementation(() => new Promise(() => undefined));
    const view = renderPrograms();

    expect(screen.getByLabelText('Loading your program library')).toBeTruthy();
    expect(screen.getByLabelText('Loading the preset catalog')).toBeTruthy();

    view.unmount();
    mockedReadProgramLibrarySnapshot.mockRejectedValue(new Error('cache broken'));
    mockedReadProgramCatalogSnapshot.mockRejectedValue(new Error('cache broken'));
    mockedFetchProgramSummaries.mockRejectedValue(new Error('server broken'));
    mockedFetchCatalogEntries.mockRejectedValue(new Error('server broken'));
    mockedIsProgramRefreshLeaseCurrent.mockReturnValue(false);
    renderPrograms();

    expect(await screen.findAllByRole('alert')).toHaveLength(2);
  });

  it('pins an owned active program before making it the Tracker default', async () => {
    mockedReadTrackerProgramId.mockResolvedValue(null);
    renderPrograms();

    fireEvent.press(await screen.findByRole('button', { name: 'Pin' }));

    await waitFor(() => {
      expect(mockedWriteTrackerProgramId).toHaveBeenCalledWith('user-a', ACTIVE.id);
    });
  });

  it('routes catalog cards to preset details instead of creating immediately', async () => {
    renderPrograms();

    fireEvent.press(await screen.findByRole('button', { name: 'View GZCLP preset' }));

    expect(mockOpenPreset).toHaveBeenCalledWith('gzclp');
    expect(mockedManageProgram).not.toHaveBeenCalled();
  });

  it('uses the management use case for lifecycle changes and refreshes local truth', async () => {
    renderPrograms();

    fireEvent.press(await screen.findByRole('button', { name: 'Complete' }));

    await waitFor(() => {
      expect(mockedManageProgram).toHaveBeenCalledWith({
        ownerUserId: 'user-a',
        programInstanceId: ACTIVE.id,
        mutation: { type: 'set_status', status: 'completed' },
      });
    });
    expect(mockedListProgramSummaries).toHaveBeenCalledTimes(2);
  });

  it('shows a reactivated program as active and auto-pinned for Tracker', async () => {
    const reactivated = {
      ...COMPLETED,
      status: 'active' as const,
      updatedAt: '2026-07-27T13:00:00.000Z',
    };
    const previousActive = {
      ...ACTIVE,
      status: 'completed' as const,
      updatedAt: reactivated.updatedAt,
    };
    mockedListProgramSummaries
      .mockResolvedValueOnce([ACTIVE, COMPLETED, ARCHIVED])
      .mockResolvedValue([reactivated, previousActive, ARCHIVED]);
    mockedReadTrackerProgramId
      .mockResolvedValueOnce(ACTIVE.id)
      .mockResolvedValueOnce(ACTIVE.id)
      .mockResolvedValue(COMPLETED.id);
    mockedManageProgram.mockResolvedValue({
      status: 'applied',
      remote: {
        id: reactivated.id,
        programId: reactivated.programId,
        name: reactivated.title,
        config: {},
        metadata: null,
        results: {},
        undoHistory: [],
        resultTimestamps: {},
        completedDates: {},
        definitionId: null,
        customDefinition: null,
        status: 'active',
        createdAt: reactivated.createdAt,
        updatedAt: reactivated.updatedAt,
      },
    });
    renderPrograms();

    const reactivate = (await screen.findAllByRole('button', { name: 'Reactivate' }))[0];
    if (!reactivate) {
      throw new Error('Expected a completed program reactivation action');
    }
    fireEvent.press(reactivate);

    await waitFor(() => {
      expect(screen.getAllByText(COMPLETED.title)).toHaveLength(2);
    });
    expect(mockedWriteTrackerProgramId).not.toHaveBeenCalled();
  });

  it('shows honest reconciliation copy after a remote ACK instead of reporting failure', async () => {
    mockedManageProgram.mockResolvedValue({
      status: 'reconciliation_required',
      remote: null,
      remoteEntityId: ACTIVE.id,
      remoteState: 'acknowledged',
      reconciliationScheduled: true,
    });
    renderPrograms();

    fireEvent.press(await screen.findByRole('button', { name: 'Complete' }));

    expect(
      await screen.findByText(
        'The result is uncertain. Review the exact saved change on the program card and retry only that change when you are ready.'
      )
    ).toBeTruthy();
    expect(
      screen.queryByText(
        'The server rejected that change before acknowledging it. Your previous local list is unchanged.'
      )
    ).toBeNull();
  });

  it('restores an exact pending expectation and exposes only its accessible retry', async () => {
    mockedReadPendingManageReconciliations.mockResolvedValue([
      {
        programInstanceId: ACTIVE.id,
        expectation: { type: 'rename', name: 'Stored restart name' },
      },
    ]);
    mockedFetchProgramSummaries.mockRejectedValue(new Error('offline after restart'));
    mockedManageProgram.mockResolvedValue({
      status: 'reconciliation_required',
      remote: null,
      remoteEntityId: ACTIVE.id,
      remoteState: 'outcome_unknown',
      reconciliationScheduled: true,
    });

    renderPrograms();

    expect(
      await screen.findByText('Pending saved change: rename this program to “Stored restart name”.')
    ).toBeTruthy();
    const retry = screen.getByRole('button', { name: 'Retry exact saved change' });
    expect(screen.getAllByRole('button', { name: 'Archive' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Rename' })).toHaveLength(2);

    fireEvent.press(retry);
    await waitFor(() => {
      expect(mockedManageProgram).toHaveBeenCalledWith({
        ownerUserId: 'user-a',
        programInstanceId: ACTIVE.id,
        mutation: { type: 'rename', name: 'Stored restart name' },
      });
    });
    expect(
      await screen.findByText('Offline: showing your last synchronized program library.')
    ).toBeTruthy();
  });

  it('removes a cleared exact recovery marker after its retry succeeds', async () => {
    mockedReadPendingManageReconciliations.mockResolvedValue([
      {
        programInstanceId: ACTIVE.id,
        expectation: { type: 'rename', name: 'Stored restart name' },
      },
    ]);
    renderPrograms();

    const retry = await screen.findByRole('button', { name: 'Retry exact saved change' });
    mockedReadPendingManageReconciliations.mockResolvedValue([]);
    fireEvent.press(retry);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Retry exact saved change' })).toBeNull();
    });
  });

  it('removes a cleared exact recovery marker after a definite retry rejection', async () => {
    mockedReadPendingManageReconciliations.mockResolvedValue([
      {
        programInstanceId: ACTIVE.id,
        expectation: { type: 'rename', name: 'Rejected retry name' },
      },
    ]);
    renderPrograms();

    const retry = await screen.findByRole('button', { name: 'Retry exact saved change' });
    mockedReadPendingManageReconciliations.mockResolvedValue([]);
    mockedManageProgram.mockRejectedValue(new Error('definite rejection'));
    fireEvent.press(retry);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Retry exact saved change' })).toBeNull();
    });
    expect(
      screen.getByText(
        'The server rejected that change before acknowledging it. Your previous local list is unchanged.'
      )
    ).toBeTruthy();
  });

  it('disables the pinned Tracker shortcut while exact recovery is unresolved', async () => {
    mockedReadPendingManageReconciliations.mockResolvedValue([
      {
        programInstanceId: ACTIVE.id,
        expectation: { type: 'rename', name: 'Stored restart name' },
      },
    ]);
    renderPrograms();

    await screen.findByRole('button', { name: 'Retry exact saved change' });
    let pinnedShortcut = screen.getByText('Open the next workout in Tracker').parent;
    while (pinnedShortcut !== null && pinnedShortcut.props.accessibilityRole !== 'button') {
      pinnedShortcut = pinnedShortcut.parent;
    }
    if (pinnedShortcut === null) throw new Error('Expected a pinned Tracker shortcut');
    expect(pinnedShortcut.props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(pinnedShortcut);
    expect(mockedWriteTrackerProgramId).not.toHaveBeenCalled();
  });

  it('clears exact recovery state synchronously when the owner changes', async () => {
    const pendingCopy = 'Pending saved change: rename this program to “Owner A name”.';
    mockedReadPendingManageReconciliations.mockResolvedValue([
      {
        programInstanceId: ACTIVE.id,
        expectation: { type: 'rename', name: 'Owner A name' },
      },
    ]);
    const view = renderPrograms();

    expect(await screen.findByText(pendingCopy)).toBeTruthy();

    mockedReadPendingManageReconciliations.mockRejectedValue(
      new Error('owner B recovery cache unavailable')
    );
    view.rerender(
      <ProgramsScreen
        onOpenPreset={mockOpenPreset}
        onOpenProgram={mockOpenProgram}
        ownerUserId="user-b"
      />
    );

    expect(screen.queryByText(pendingCopy)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry exact saved change' })).toBeNull();
    await waitFor(() => {
      expect(mockedReadPendingManageReconciliations).toHaveBeenCalledWith('user-b');
    });
    expect(screen.queryByText(pendingCopy)).toBeNull();
  });

  it('blocks conflicting management for a legacy unknown reconciliation', async () => {
    mockedReadPendingManageReconciliations.mockResolvedValue([
      {
        programInstanceId: ACTIVE.id,
        expectation: null,
      },
    ]);
    mockedFetchProgramSummaries.mockRejectedValue(new Error('offline after upgrade'));

    renderPrograms();

    expect(
      await screen.findByText(
        'A change from an earlier app version has an unknown result. Other changes are blocked; delete the program to resolve it.'
      )
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Complete' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Delete' }).length).toBeGreaterThan(0);
  });

  it('surfaces a durable pending delete and suppresses an older manage retry', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    mockedReadPendingManageReconciliations.mockResolvedValue([
      {
        programInstanceId: ACTIVE.id,
        expectation: { type: 'rename', name: 'Older pending rename' },
      },
    ]);
    mockedReadPendingDeleteReconciliations.mockResolvedValue([ACTIVE.id]);
    mockedFetchProgramSummaries.mockRejectedValue(new Error('offline after uncertain delete'));

    renderPrograms();

    expect(
      await screen.findByText(
        'Deletion is still being verified. Other changes are blocked; retry deletion or check whether it has finished.'
      )
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry exact saved change' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Complete' })).toBeNull();

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    const activeDelete = deleteButtons[0];
    if (!activeDelete) throw new Error('Expected an idempotent pending-delete action');
    fireEvent.press(activeDelete);
    expect(alert).toHaveBeenCalledWith(
      'Delete program?',
      `${ACTIVE.title} and its locally cached workout data will be deleted only after the server confirms the deletion.`,
      expect.any(Array)
    );

    let rejectDelete = (): void => undefined;
    mockedDeleteProgram.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectDelete = () => reject(new Error('definite delete rejection'));
        })
    );
    const actions = alert.mock.calls[0]?.[2];
    const destructive = actions?.find((action) => action.style === 'destructive');
    await act(async () => {
      destructive?.onPress?.();
    });

    expect(mockedDeleteProgram).toHaveBeenCalledWith({
      ownerUserId: 'user-a',
      programInstanceId: ACTIVE.id,
    });
    expect(await screen.findByLabelText(`Updating ${ACTIVE.title}`)).toBeTruthy();
    await act(async () => {
      rejectDelete();
    });
    await waitFor(() => {
      expect(screen.queryByLabelText(`Updating ${ACTIVE.title}`)).toBeNull();
    });
    expect(
      await screen.findByText(
        'Deletion is still being verified. Other changes are blocked; retry deletion or check whether it has finished.'
      )
    ).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Check deletion status' }));

    await waitFor(() => {
      expect(mockedVerifyPendingProgramDelete).toHaveBeenCalledWith({
        ownerUserId: 'user-a',
        programInstanceId: ACTIVE.id,
      });
    });
    expect(
      screen.getByText(
        'Deletion is still being verified. Other changes are blocked; retry deletion or check whether it has finished.'
      )
    ).toBeTruthy();
  });

  it('reveals every exact stored config value before allowing its retry', async () => {
    mockedReadPendingManageReconciliations.mockResolvedValue([
      {
        programInstanceId: ACTIVE.id,
        expectation: {
          type: 'set_config',
          config: { squat: 42.5, variant: 'paused' },
        },
      },
    ]);
    mockedFetchProgramSummaries.mockRejectedValue(new Error('offline after restart'));
    mockedManageProgram.mockResolvedValue({
      status: 'reconciliation_required',
      remote: null,
      remoteEntityId: ACTIVE.id,
      remoteState: 'outcome_unknown',
      reconciliationScheduled: true,
    });

    renderPrograms();

    expect(
      await screen.findByText(
        'Pending saved change: apply this exact setup: {"squat":42.5,"variant":"paused"}.'
      )
    ).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Retry exact saved change' }));
    await waitFor(() => {
      expect(mockedManageProgram).toHaveBeenCalledWith({
        ownerUserId: 'user-a',
        programInstanceId: ACTIVE.id,
        mutation: {
          type: 'set_config',
          config: { squat: 42.5, variant: 'paused' },
        },
      });
    });
    expect(
      await screen.findByText('Offline: showing your last synchronized program library.')
    ).toBeTruthy();
  });

  it('disables pending recovery actions while their exact retry is in flight', async () => {
    mockedReadPendingManageReconciliations.mockResolvedValue([
      {
        programInstanceId: ACTIVE.id,
        expectation: { type: 'rename', name: 'Stored restart name' },
      },
    ]);
    mockedFetchProgramSummaries.mockRejectedValue(new Error('offline after restart'));
    mockedManageProgram.mockImplementation(() => new Promise<never>(() => undefined));

    renderPrograms();

    const retry = await screen.findByRole('button', { name: 'Retry exact saved change' });
    fireEvent.press(retry);

    await waitFor(() => {
      expect(screen.getByLabelText(`Updating ${ACTIVE.title}`)).toBeTruthy();
    });
    expect(retry.props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(retry);
    expect(mockedManageProgram).toHaveBeenCalledTimes(1);
  });

  it('serializes management actions while a mutation is in flight', async () => {
    mockedManageProgram.mockImplementation(() => new Promise<never>(() => {}));
    renderPrograms();

    const complete = await screen.findByRole('button', { name: 'Complete' });
    const archive = screen.getAllByRole('button', { name: 'Archive' })[0];
    if (!archive) throw new Error('Expected an archive action before the mutation starts');
    fireEvent.press(complete);
    fireEvent.press(archive);

    expect(mockedManageProgram).toHaveBeenCalledTimes(1);
  });

  it('does not carry an in-flight mutation or its late notice across an owner switch', async () => {
    let resolveOwnerAMutation: (result: Awaited<ReturnType<typeof manageProgram>>) => void = () =>
      undefined;
    mockedManageProgram
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOwnerAMutation = resolve;
          })
      )
      .mockResolvedValueOnce({
        status: 'applied',
        remote: {
          id: ACTIVE.id,
          programId: ACTIVE.programId,
          name: ACTIVE.title,
          config: {},
          metadata: null,
          results: {},
          undoHistory: [],
          resultTimestamps: {},
          completedDates: {},
          definitionId: null,
          customDefinition: null,
          status: 'active',
          createdAt: ACTIVE.createdAt,
          updatedAt: ACTIVE.updatedAt,
        },
      });
    const view = renderPrograms();

    fireEvent.press(await screen.findByRole('button', { name: 'Complete' }));
    await waitFor(() => {
      expect(mockedManageProgram).toHaveBeenCalledWith({
        ownerUserId: 'user-a',
        programInstanceId: ACTIVE.id,
        mutation: { type: 'set_status', status: 'completed' },
      });
    });

    view.rerender(
      <ProgramsScreen
        onOpenPreset={mockOpenPreset}
        onOpenProgram={mockOpenProgram}
        ownerUserId="user-b"
      />
    );
    fireEvent.press(await screen.findByRole('button', { name: 'Complete' }));
    await waitFor(() => {
      expect(mockedManageProgram).toHaveBeenCalledWith({
        ownerUserId: 'user-b',
        programInstanceId: ACTIVE.id,
        mutation: { type: 'set_status', status: 'completed' },
      });
    });

    view.rerender(
      <ProgramsScreen
        onOpenPreset={mockOpenPreset}
        onOpenProgram={mockOpenProgram}
        ownerUserId="user-a"
      />
    );
    fireEvent.press(await screen.findByRole('button', { name: 'Complete' }));
    await waitFor(() => {
      expect(mockedManageProgram).toHaveBeenCalledTimes(3);
    });

    await act(async () => {
      resolveOwnerAMutation({
        status: 'reconciliation_required',
        remote: null,
        remoteEntityId: ACTIVE.id,
        remoteState: 'outcome_unknown',
        reconciliationScheduled: true,
      });
      await Promise.resolve();
    });

    expect(
      screen.queryByText(
        'The result is uncertain. Review the exact saved change on the program card and retry only that change when you are ready.'
      )
    ).toBeNull();
  });

  it('renames through the same server-first management path', async () => {
    renderPrograms();

    const renameButtons = await screen.findAllByRole('button', { name: 'Rename' });
    const firstRename = renameButtons[0];
    if (!firstRename) {
      throw new Error('Expected a rename action');
    }
    fireEvent.press(firstRename);
    fireEvent.changeText(screen.getByLabelText('New name for Active program'), 'Strength block');
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockedManageProgram).toHaveBeenCalledWith({
        ownerUserId: 'user-a',
        programInstanceId: ACTIVE.id,
        mutation: { type: 'rename', name: 'Strength block' },
      });
    });
  });

  it('requires destructive confirmation before deletion', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    renderPrograms();

    const deleteButtons = await screen.findAllByRole('button', { name: 'Delete' });
    const firstDelete = deleteButtons[0];
    if (!firstDelete) {
      throw new Error('Expected a delete action');
    }
    fireEvent.press(firstDelete);

    expect(mockedDeleteProgram).not.toHaveBeenCalled();
    const actions = alert.mock.calls[0]?.[2];
    const destructive = actions?.find((action) => action.style === 'destructive');
    await act(async () => {
      destructive?.onPress?.();
    });

    await waitFor(() => {
      expect(mockedDeleteProgram).toHaveBeenCalledWith({
        ownerUserId: 'user-a',
        programInstanceId: ACTIVE.id,
      });
    });
  });
});
