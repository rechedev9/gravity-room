import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { CatalogEntry } from '@gzclp/domain';

import {
  listProgramSummaries,
  readProgramCatalogSnapshot,
  readProgramLibrarySnapshot,
  replaceCachedCatalog,
  replaceProgramSummaries,
} from '../../lib/programs/program-repository';
import { deleteProgram, manageProgram } from '../../lib/programs/program-use-cases';
import { fetchCatalogEntries, fetchProgramSummaries } from '../../lib/programs/program-service';
import {
  readTrackerProgramId,
  writeTrackerProgramId,
} from '../../lib/tracker/tracker-selection-storage';
import { ProgramsScreen } from './programs-screen';

jest.mock('../../lib/programs/program-repository', () => ({
  listProgramSummaries: jest.fn(),
  readProgramCatalogSnapshot: jest.fn(),
  readProgramLibrarySnapshot: jest.fn(),
  replaceCachedCatalog: jest.fn(),
  replaceProgramSummaries: jest.fn(),
}));

jest.mock('../../lib/programs/program-use-cases', () => ({
  deleteProgram: jest.fn(),
  manageProgram: jest.fn(),
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
const mockedReplaceCachedCatalog = jest.mocked(replaceCachedCatalog);
const mockedReplaceProgramSummaries = jest.mocked(replaceProgramSummaries);
const mockedDeleteProgram = jest.mocked(deleteProgram);
const mockedManageProgram = jest.mocked(manageProgram);
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

function renderPrograms() {
  return render(
    <ProgramsScreen
      onOpenPreset={mockOpenPreset}
      onOpenProgram={mockOpenProgram}
      ownerUserId="user-a"
    />
  );
}

describe('ProgramsScreen M2 library', () => {
  beforeEach(() => {
    mockedListProgramSummaries.mockResolvedValue([ACTIVE, COMPLETED, ARCHIVED]);
    mockedFetchProgramSummaries.mockResolvedValue([ACTIVE, COMPLETED, ARCHIVED]);
    mockedReplaceProgramSummaries.mockResolvedValue();
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
    mockedReplaceCachedCatalog.mockResolvedValue();
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
        'The server may already have applied this change. Gravity Room will verify it safely; do not repeat the action.'
      )
    ).toBeTruthy();
    expect(
      screen.queryByText(
        'The server rejected that change before acknowledging it. Your previous local list is unchanged.'
      )
    ).toBeNull();
  });

  it('serializes management actions while a mutation is in flight', async () => {
    mockedManageProgram.mockImplementation(() => new Promise<never>(() => {}));
    renderPrograms();

    fireEvent.press(await screen.findByRole('button', { name: 'Complete' }));
    fireEvent.press(screen.getByRole('button', { name: 'Archive' }));

    expect(mockedManageProgram).toHaveBeenCalledTimes(1);
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
