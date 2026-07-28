import { Pressable, Text } from 'react-native';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { useRouter } from 'expo-router';

import TabsLayout from '../app/(protected)/(tabs)/_layout';
import ProgramsStackLayout from '../app/(protected)/(tabs)/programs/_layout';
import ProfileStackLayout from '../app/(protected)/(tabs)/profile/_layout';
import TrackerStackLayout from '../app/(protected)/(tabs)/tracker/_layout';
import ProgramsRoute from '../app/(protected)/(tabs)/programs/index';
import type { ProgramSummary } from '../lib/programs/program-repository';

const mockListProgramSummaries = jest.fn();
const mockFetchProgramSummaries = jest.fn();
const mockCatalogEntry = {
  id: 'gzclp',
  name: 'Contenido canónico sin localizar',
  description: 'Descripción canónica sin localizar',
  author: 'Gravity Room',
  category: 'strength',
  level: 'beginner',
  source: 'preset',
  totalWorkouts: 90,
  workoutsPerWeek: 3,
  cycleLength: 4,
};

jest.mock('../providers/auth-provider', () => ({
  useAuth: () => ({
    user: {
      id: 'user-a',
      email: 'athlete@example.com',
      name: null,
      avatarUrl: null,
    },
  }),
}));

jest.mock('../lib/programs/program-repository', () => ({
  commitProgramCatalogRefresh: jest.fn(async () => true),
  commitProgramSummariesRefresh: jest.fn(async () => true),
  listProgramSummaries: () => mockListProgramSummaries(),
  readPendingDeleteReconciliations: jest.fn(async () => []),
  readPendingManageReconciliations: jest.fn(async () => []),
  readProgramLibrarySnapshot: jest.fn(async () => ({
    status: 'snapshot',
    data: mockLocalPrograms,
    syncedAt: '2026-07-27T12:00:00.000Z',
  })),
  readProgramCatalogSnapshot: jest.fn(async () => ({
    status: 'snapshot',
    data: [mockCatalogEntry],
    syncedAt: '2026-07-27T12:00:00.000Z',
  })),
}));

jest.mock('../lib/programs/program-service', () => ({
  fetchProgramSummaries: () => mockFetchProgramSummaries(),
  fetchCatalogEntries: jest.fn(async () => [mockCatalogEntry]),
}));

jest.mock('../lib/auth/session', () => ({
  captureAuthorizedSession: jest.fn(() => ({
    ownerUserId: 'user-a',
    accessToken: 'token-a',
    generation: 1,
  })),
  isAuthorizedSessionCurrent: jest.fn(() => true),
}));

jest.mock('../lib/programs/program-refresh-generation', () => ({
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

jest.mock('../lib/tracker/tracker-selection-storage', () => ({
  readTrackerProgramId: jest.fn(async () => null),
  writeTrackerProgramId: jest.fn(async () => undefined),
}));

jest.mock('../lib/programs/program-use-cases', () => ({
  manageProgram: jest.fn(),
  deleteProgram: jest.fn(),
  reconcilePendingProgramManagement: jest.fn(async () => undefined),
  verifyPendingProgramDelete: jest.fn(async () => 'still_pending'),
}));

const ORIGINAL: ProgramSummary = {
  id: '11111111-1111-4111-8111-111111111111',
  programId: 'gzclp',
  title: 'Original program',
  status: 'active',
  createdAt: '2026-07-27T10:00:00.000Z',
  updatedAt: '2026-07-27T10:00:00.000Z',
};

const CREATED: ProgramSummary = {
  ...ORIGINAL,
  id: '22222222-2222-4222-8222-222222222222',
  title: 'Created in setup',
  updatedAt: '2026-07-27T11:00:00.000Z',
};

let mockLocalPrograms: ProgramSummary[] = [];

function SetupProbe() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        mockLocalPrograms = [CREATED, ...mockLocalPrograms];
        router.back();
      }}
    >
      <Text>Finish setup</Text>
    </Pressable>
  );
}

function TrackerProbe() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        mockLocalPrograms = mockLocalPrograms.map((program) =>
          program.id === ORIGINAL.id ? { ...program, title: 'Updated in Tracker' } : program
        );
        router.back();
      }}
    >
      <Text>Return from Tracker</Text>
    </Pressable>
  );
}

function EmptyTabProbe() {
  return <Text>Empty tab</Text>;
}

describe('Programs focus refresh integration', () => {
  beforeEach(() => {
    mockLocalPrograms = [ORIGINAL];
    mockListProgramSummaries.mockImplementation(async () => mockLocalPrograms);
    mockFetchProgramSummaries.mockImplementation(async () => mockLocalPrograms);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('re-reads local truth after returning from setup and Tracker', async () => {
    renderRouter(
      {
        '(protected)/(tabs)/_layout': TabsLayout,
        '(protected)/(tabs)/programs/_layout': ProgramsStackLayout,
        '(protected)/(tabs)/programs/index': ProgramsRoute,
        '(protected)/(tabs)/tracker/_layout': TrackerStackLayout,
        '(protected)/(tabs)/tracker/index': EmptyTabProbe,
        '(protected)/(tabs)/profile/_layout': ProfileStackLayout,
        '(protected)/(tabs)/profile/index': EmptyTabProbe,
        '(protected)/program/new': SetupProbe,
        '(protected)/program/[instanceId]': TrackerProbe,
      },
      { initialUrl: '/programs' }
    );

    fireEvent.press(await screen.findByRole('button', { name: 'View GZCLP preset' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Finish setup' }));
    expect(await screen.findByText('Created in setup')).toBeTruthy();

    const openButtons = await screen.findAllByRole('button', { name: 'Open' });
    const originalOpen = openButtons[1];
    if (!originalOpen) {
      throw new Error('Expected the original program open action');
    }
    fireEvent.press(originalOpen);
    fireEvent.press(await screen.findByRole('button', { name: 'Return from Tracker' }));

    await waitFor(() => {
      expect(screen.getByText('Updated in Tracker')).toBeTruthy();
    });
    expect(mockListProgramSummaries.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
