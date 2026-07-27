import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { CatalogEntry } from '@gzclp/domain';

import {
  listCachedCatalog,
  listProgramSummaries,
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
  listCachedCatalog: jest.fn(),
  listProgramSummaries: jest.fn(),
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

const mockedListCachedCatalog = jest.mocked(listCachedCatalog);
const mockedListProgramSummaries = jest.mocked(listProgramSummaries);
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
    mockedListCachedCatalog.mockResolvedValue([CATALOG_ENTRY]);
    mockedFetchCatalogEntries.mockResolvedValue([CATALOG_ENTRY]);
    mockedReplaceCachedCatalog.mockResolvedValue();
    mockedReadTrackerProgramId.mockResolvedValue(ACTIVE.id);
    mockedWriteTrackerProgramId.mockResolvedValue();
    mockedManageProgram.mockResolvedValue({
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
    });
    mockedDeleteProgram.mockResolvedValue();
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
    mockedListCachedCatalog.mockResolvedValue([]);
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
    expect(mockedListProgramSummaries).toHaveBeenCalledTimes(3);
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
